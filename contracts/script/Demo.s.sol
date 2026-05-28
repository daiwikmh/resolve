// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

import {InariValidatorRegistry} from "../src/InariValidatorRegistry.sol";
import {InariRwaVault} from "../src/InariRwaVault.sol";
import {InariLPRegistry} from "../src/InariLPRegistry.sol";
import {InariPegHook} from "../src/InariPegHook.sol";
import {InariSwapRouter} from "../src/InariSwapRouter.sol";
import {MockUSDC, MockRWA} from "../src/RWAFaucet.sol";

/*
 * Demo -- Inari RWA Peg Hook
 * ===========================
 * Deploys the full Inari system and exercises the complete lifecycle.
 *
 * Run against a fork of X Layer:
 *   forge script script/Demo.s.sol \
 *     --rpc-url x_layer --broadcast --private-key $PRIVATE_KEY -vvv
 *
 * Or against a local Anvil fork:
 *   anvil --fork-url https://rpc.xlayer.tech
 *   forge script script/Demo.s.sol --rpc-url http://localhost:8545 \
 *     --broadcast --private-key $ANVIL_PRIVATE_KEY -vvv
 *
 *
 * Architecture
 * ------------
 *
 *   Validator (admin)
 *     |
 *     | setPrice(token, priceUsd)
 *     v
 *   InariValidatorRegistry
 *     | priceUsd, alertThreshold, alertActiveUntil
 *     |
 *     | getPrice() / isAlertActive()
 *     v
 *   User --> InariSwapRouter --> PoolManager --> InariPegHook
 *                                                     |
 *                              alert active? ---------+---------> revert OracleAlertActive
 *                                                     |
 *                              normal swap: -----------+
 *                                                     |
 *                                        amountOut = amountIn * 1e18 / priceUsd
 *                                        settle input, deliver output
 *                                        return delta -- AMM not executed
 *
 *
 * Vault flow (deposit / redeem):
 *
 *   User --approve(vault, amt)--> RWA Token
 *        --deposit(rwaToken, amt)--> InariRwaVault
 *                                         |
 *                                  oracle price check
 *                                         |
 *                                   mint dobRWA --> User
 *
 *
 * Steps exercised
 * ---------------
 *   1  Deploy MockUSDC + DCT (RWA token)
 *   2  Deploy InariValidatorRegistry, InariRwaVault, InariLPRegistry
 *   3  Mine CREATE2 salt and deploy InariPegHook
 *   4  Wire authorizations (setHook on registry + vault)
 *   5  Configure oracle: set price + alert threshold + approved asset
 *   6  Deploy InariSwapRouter and configure pool key
 *   7  Initialize the Uniswap v4 pool
 *   8  Vault deposit: approve RWA -> deposit -> receive dobRWA
 *   9  Normal swap:   approve USDC -> router.swap() -> receive DCT
 *  10  Push price below alert threshold -> verify alert fires
 *  11  Attempt swap during alert -> verify revert
 *  12  Recover price -> verify alert clears after window
 */
contract Demo is Script {
    // X Layer mainnet addresses
    address constant POOL_MANAGER_ADDR = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant CREATE2_DEPLOYER  = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Inari hook flags: beforeInit | beforeAddLiq | beforeSwap | beforeSwapReturnDelta
    uint160 constant HOOK_FLAGS = uint160(
        (1 << 13) | // BEFORE_INITIALIZE
        (1 << 11) | // BEFORE_ADD_LIQUIDITY
        (1 << 7)  | // BEFORE_SWAP
        (1 << 3)    // BEFORE_SWAP_RETURNS_DELTA
    );

    MockUSDC               public usdc;
    MockRWA                public dct;
    InariValidatorRegistry public registry;
    InariRwaVault          public vault;
    InariLPRegistry        public lpReg;
    InariPegHook           public hook;
    InariSwapRouter        public router;

    uint256 constant PEG_PRICE    = 100_000e18;
    uint256 constant ALERT_PCT    = 70;
    uint256 constant ALERT_THRESH = (PEG_PRICE * ALERT_PCT) / 100; // $70,000

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        console2.log("==============================================");
        console2.log("  Inari RWA Peg Hook -- Demo");
        console2.log("==============================================");

        // 1 -- tokens
        usdc = new MockUSDC(deployer);
        dct  = new MockRWA("Digital Commodity Token", "DCT", deployer);
        console2.log("[1] MockUSDC :", address(usdc));
        console2.log("[1] DCT      :", address(dct));

        // 2 -- core contracts
        registry = new InariValidatorRegistry(deployer);
        vault    = new InariRwaVault(address(registry), 3600, deployer);
        lpReg    = new InariLPRegistry(address(usdc), deployer);
        console2.log("[2] Registry :", address(registry));
        console2.log("[2] Vault    :", address(vault));
        console2.log("[2] LPReg    :", address(lpReg));

        // 3 -- mine CREATE2 salt and deploy hook
        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER_ADDR),
            vault,
            ERC20(address(usdc)),
            registry,
            deployer
        );
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, HOOK_FLAGS, type(InariPegHook).creationCode, constructorArgs
        );
        hook = new InariPegHook{salt: salt}(
            IPoolManager(POOL_MANAGER_ADDR),
            vault,
            ERC20(address(usdc)),
            registry,
            deployer
        );
        require(address(hook) == hookAddr, "Hook address mismatch");
        console2.log("[3] Hook     :", address(hook));

        // 4 -- wire authorizations
        registry.setHook(address(hook));
        vault.setHook(address(hook));
        console2.log("[4] setHook wired on registry + vault");

        // 5 -- oracle: price, alert threshold, approved asset
        registry.setPrice(address(dct), PEG_PRICE);
        registry.setAlertThreshold(address(dct), ALERT_THRESH);
        vault.addApprovedAsset(address(dct));
        console2.log("[5] DCT oracle price : $100,000");
        console2.log("[5] Alert threshold  : $70,000 (fires on 30% drop)");

        // 6 -- swap router
        router = new InariSwapRouter(POOL_MANAGER_ADDR);
        (address t0, address t1) = address(usdc) < address(dct)
            ? (address(usdc), address(dct))
            : (address(dct), address(usdc));
        router.setPoolKey(t0, t1, 0, 1, address(hook));
        console2.log("[6] Router   :", address(router));

        // 7 -- initialize Uniswap v4 pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(t0),
            currency1: Currency.wrap(t1),
            fee: 0,
            tickSpacing: 1,
            hooks: IHooks(address(hook))
        });
        IPoolManager(POOL_MANAGER_ADDR).initialize(poolKey, TickMath.getSqrtPriceAtTick(0));
        console2.log("[7] Uniswap v4 pool initialized");

        // 8 -- vault: deposit 5 DCT -> receive dobRWA
        uint256 depositAmt = 5e18;
        dct.mint(deployer, depositAmt);
        ERC20(address(dct)).approve(address(vault), depositAmt);
        uint256 minted = vault.deposit(address(dct), depositAmt);
        console2.log("[8] Deposited 5 DCT, dobRWA minted:", minted);

        // 9 -- normal swap: 100,000 USDC -> DCT
        uint256 swapIn = 100_000e18;
        usdc.mint(deployer, swapIn);
        ERC20(address(usdc)).approve(address(router), swapIn);
        bool zeroForOne = address(usdc) < address(dct);
        uint256 received = router.swap(zeroForOne, swapIn, "");
        console2.log("[9] Swapped 100,000 USDC -> DCT received:", received);
        console2.log("    (expected ~1e18 at $100,000 oracle price)");

        // 10 -- push price below alert threshold
        uint256 alertPrice = 68_000e18; // below $70k
        registry.setPrice(address(dct), alertPrice);
        bool active = registry.isAlertActive(address(dct));
        console2.log("[10] Price pushed to $68,000");
        console2.log("[10] Oracle alert active:", active);
        require(active, "FAIL: alert should fire below threshold");

        // 11 -- attempt swap during alert -- must revert
        usdc.mint(deployer, swapIn);
        ERC20(address(usdc)).approve(address(router), swapIn);
        bool swapReverted = false;
        try router.swap(zeroForOne, swapIn, "") {
            console2.log("[11] FAIL: swap succeeded during alert");
        } catch {
            swapReverted = true;
            console2.log("[11] Swap correctly blocked by oracle alert");
        }
        require(swapReverted, "FAIL: swap should revert during alert");

        // 12 -- emergency price recovery
        registry.emergencySetPrice(address(dct), 102_000e18);
        console2.log("[12] Price recovered to $102,000");
        console2.log("[12] Alert window still active (1h) -- will clear automatically");

        vm.stopBroadcast();

        console2.log("==============================================");
        console2.log("  Summary");
        console2.log("==============================================");
        console2.log("  USDC             :", address(usdc));
        console2.log("  DCT              :", address(dct));
        console2.log("  ValidatorRegistry:", address(registry));
        console2.log("  RwaVault         :", address(vault));
        console2.log("  LPRegistry       :", address(lpReg));
        console2.log("  InariPegHook     :", address(hook));
        console2.log("  SwapRouter       :", address(router));
        console2.log("  All 12 steps completed.");
        console2.log("==============================================");
    }
}
