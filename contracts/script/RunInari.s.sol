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
 * RunInari.s.sol
 *
 * Deploys and exercises the full Inari stack on a fork or mainnet.
 *
 * Usage (Anvil fork — free, recommended):
 *   anvil --fork-url https://rpc.xlayer.tech
 *   PRIVATE_KEY=0x<anvil-key> forge script script/RunInari.s.sol \
 *     --rpc-url http://localhost:8545 --broadcast -vvv
 *
 * Usage (X Layer mainnet):
 *   PRIVATE_KEY=0x<your-key> forge script script/RunInari.s.sol \
 *     --rpc-url https://rpc.xlayer.tech --broadcast -vvv
 *
 *
 * System diagram
 * --------------
 *
 *   DCT (MockRWA)
 *      |
 *      | deposit(dct, amount)
 *      v
 *   InariRwaVault  <-- IS the dobRWA ERC-20
 *      |  mints dobRWA = amount * oraclePrice / 1e18
 *      |
 *      |  dobRWA lives in pool alongside USDC
 *      v
 *   Uniswap v4 Pool  [ USDC <-> dobRWA ]
 *      |
 *      | beforeSwap()
 *      v
 *   InariPegHook
 *      |
 *      |-- sell (dobRWA->USDC): hook pays USDC from reserves, checks oracle alert
 *      |-- buy  (USDC->dobRWA): hook pays dobRWA 1:1, no alert gate
 *      |
 *      v
 *   InariValidatorRegistry  (price feed + alert window)
 *
 *
 * Hook reserve model
 * ------------------
 *
 *   Buy  (USDC -> dobRWA) : hook needs dobRWA balance to deliver
 *   Sell (dobRWA -> USDC) : hook needs USDC balance (totalUsdc - totalLpUsdc)
 *
 *   Pre-funding:
 *     USDC  -> transfer directly to hook (not via depositUsdc, so totalLpUsdc stays 0)
 *     dobRWA -> vault.transfer(hook, amount)
 *
 */
contract RunInari is Script {
    address constant POOL_MANAGER_ADDR = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant CREATE2_DEPLOYER  = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // beforeInit | beforeAddLiq | beforeSwap | beforeSwapReturnDelta
    uint160 constant HOOK_FLAGS =
        (1 << 13) | (1 << 11) | (1 << 7) | (1 << 3);

    uint256 constant PEG_PRICE    = 100_000e18; // $100,000 per DCT
    uint256 constant ALERT_THRESH = 70_000e18;  // alert fires below $70,000

    MockUSDC               usdc;
    MockRWA                dct;
    InariValidatorRegistry registry;
    InariRwaVault          vault;
    InariLPRegistry        lpReg;
    InariPegHook           hook;
    InariSwapRouter        router;

    function run() external {
        uint256 pk      = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.startBroadcast(pk);

        _step1_tokens(deployer);
        _step2_core(deployer);
        _step3_hook(deployer);
        _step4_wire();
        _step5_oracle(deployer);
        _step6_router();
        _step7_pool(deployer);
        _step8_vaultDeposit(deployer);
        _step9_prefundHook(deployer);
        _step10_sell(deployer);
        _step11_buy(deployer);
        _step12_alertAndBlock(deployer);

        vm.stopBroadcast();
        _printSummary();
    }

    // ── 1: tokens ─────────────────────────────────────────────────────────
    function _step1_tokens(address deployer) internal {
        usdc = new MockUSDC(deployer);
        dct  = new MockRWA("Digital Commodity Token", "DCT", deployer);
        console2.log("[1] USDC     :", address(usdc));
        console2.log("[1] DCT      :", address(dct));
    }

    // ── 2: core contracts ─────────────────────────────────────────────────
    function _step2_core(address deployer) internal {
        registry = new InariValidatorRegistry(deployer);
        vault    = new InariRwaVault(address(registry), 3600, deployer);
        lpReg    = new InariLPRegistry(address(usdc), deployer);
        console2.log("[2] Registry :", address(registry));
        console2.log("[2] Vault    :", address(vault));
        console2.log("[2] LPReg   :", address(lpReg));
    }

    // ── 3: mine CREATE2 salt + deploy hook ────────────────────────────────
    function _step3_hook(address deployer) internal {
        bytes memory args = abi.encode(
            IPoolManager(POOL_MANAGER_ADDR),
            vault,
            ERC20(address(usdc)),
            registry,
            deployer
        );
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, HOOK_FLAGS, type(InariPegHook).creationCode, args
        );
        hook = new InariPegHook{salt: salt}(
            IPoolManager(POOL_MANAGER_ADDR),
            vault,
            ERC20(address(usdc)),
            registry,
            deployer
        );
        require(address(hook) == hookAddr, "hook address mismatch");
        console2.log("[3] Hook     :", address(hook));
    }

    // ── 4: wire authorizations ────────────────────────────────────────────
    function _step4_wire() internal {
        registry.setHook(address(hook));
        vault.setHook(address(hook));
        console2.log("[4] setHook wired");
    }

    // ── 5: oracle config ──────────────────────────────────────────────────
    function _step5_oracle(address deployer) internal {
        registry.setPrice(address(dct), PEG_PRICE);
        registry.setAlertThreshold(address(dct), ALERT_THRESH);
        vault.addApprovedAsset(address(dct));
        console2.log("[5] Price    : $100,000 | Threshold: $70,000");
    }

    // ── 6: swap router ────────────────────────────────────────────────────
    function _step6_router() internal {
        router = new InariSwapRouter(POOL_MANAGER_ADDR);
        // Pool is USDC <-> vault (dobRWA) — vault IS the dobRWA ERC-20
        (address t0, address t1) = address(vault) < address(usdc)
            ? (address(vault), address(usdc))
            : (address(usdc), address(vault));
        router.setPoolKey(t0, t1, 0, 1, address(hook));
        console2.log("[6] Router   :", address(router));
        console2.log("[6] Pool pair: vault (dobRWA) <-> USDC");
    }

    // ── 7: initialize Uniswap v4 pool ─────────────────────────────────────
    function _step7_pool(address deployer) internal {
        (address t0, address t1) = address(vault) < address(usdc)
            ? (address(vault), address(usdc))
            : (address(usdc), address(vault));
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(t0),
            currency1: Currency.wrap(t1),
            fee: 0,
            tickSpacing: 1,
            hooks: IHooks(address(hook))
        });
        // Hook gated: sender must be admin (== deployer)
        IPoolManager(POOL_MANAGER_ADDR).initialize(key, TickMath.getSqrtPriceAtTick(0));
        console2.log("[7] Pool initialized (dobRWA/USDC)");
    }

    // ── 8: vault deposit — DCT -> dobRWA ──────────────────────────────────
    function _step8_vaultDeposit(address deployer) internal {
        uint256 dctAmt = 10e18; // 10 DCT
        dct.mint(deployer, dctAmt);
        ERC20(address(dct)).approve(address(vault), dctAmt);
        uint256 minted = vault.deposit(address(dct), dctAmt);
        // 10 DCT * $100,000 = $1,000,000 = 1,000,000 dobRWA
        console2.log("[8] Deposited 10 DCT -> dobRWA minted:", minted);
    }

    // ── 9: pre-fund hook reserves ─────────────────────────────────────────
    //   Buy  side (USDC -> dobRWA): hook must hold dobRWA to deliver
    //   Sell side (dobRWA -> USDC): hook must hold USDC to pay out
    function _step9_prefundHook(address deployer) internal {
        uint256 reserve = 200_000e18;

        // dobRWA reserve (vault IS the dobRWA ERC-20 so just transfer)
        ERC20(address(vault)).transfer(address(hook), reserve);

        // USDC reserve (direct transfer — keeps totalLpUsdc == 0 so full
        // balance is available for normal sells via _handleNormalSell)
        usdc.mint(deployer, reserve);
        ERC20(address(usdc)).transfer(address(hook), reserve);

        console2.log("[9] Hook funded: 200k dobRWA + 200k USDC");
    }

    // ── 10: sell — dobRWA -> USDC ─────────────────────────────────────────
    function _step10_sell(address deployer) internal {
        uint256 swapAmt = 10_000e18; // 10,000 dobRWA

        // Determine direction: if vault is currency0, zeroForOne=true sells vault
        bool vaultIsC0 = address(vault) < address(usdc);
        bool zeroForOne = vaultIsC0; // send c0 (vault) receive c1 (USDC)

        // hookData: encode rwaToken so hook routes through normal sell + alert check
        bytes memory hookData = abi.encode(address(dct));

        ERC20(address(vault)).approve(address(router), swapAmt);
        uint256 before = ERC20(address(usdc)).balanceOf(deployer);
        router.swap(zeroForOne, swapAmt, hookData);
        uint256 received = ERC20(address(usdc)).balanceOf(deployer) - before;
        console2.log("[10] Sold 10,000 dobRWA -> USDC received:", received);
    }

    // ── 11: buy — USDC -> dobRWA ──────────────────────────────────────────
    function _step11_buy(address deployer) internal {
        uint256 swapAmt = 10_000e18; // 10,000 USDC

        bool vaultIsC0 = address(vault) < address(usdc);
        bool zeroForOne = !vaultIsC0; // send c1 (USDC) receive c0 (vault)

        usdc.mint(deployer, swapAmt);
        ERC20(address(usdc)).approve(address(router), swapAmt);
        uint256 before = ERC20(address(vault)).balanceOf(deployer);
        router.swap(zeroForOne, swapAmt, "");
        uint256 received = ERC20(address(vault)).balanceOf(deployer) - before;
        console2.log("[11] Bought with 10,000 USDC -> dobRWA received:", received);
    }

    // ── 12: oracle alert — block sell, buy passes ─────────────────────────
    function _step12_alertAndBlock(address deployer) internal {
        // Push price below threshold -> alert fires
        registry.setPrice(address(dct), 65_000e18);
        require(registry.isAlertActive(address(dct)), "alert should be active");
        console2.log("[12] Price dropped to $65,000 -> alert active");

        // Sell with rwaToken in hookData -> revert OracleAlertActive
        bool vaultIsC0  = address(vault) < address(usdc);
        bool sellZ4O    = vaultIsC0;
        bytes memory hd = abi.encode(address(dct));
        uint256 sellAmt = 1_000e18;
        ERC20(address(vault)).approve(address(router), sellAmt);
        bool blocked = false;
        try router.swap(sellZ4O, sellAmt, hd) {
            console2.log("[12] UNEXPECTED: sell succeeded during alert");
        } catch {
            blocked = true;
            console2.log("[12] Sell correctly blocked by oracle alert");
        }
        require(blocked, "sell must be blocked during alert");

        // Buy with empty hookData -> no alert gate, passes through
        bool buyZ4O = !vaultIsC0;
        usdc.mint(deployer, sellAmt);
        ERC20(address(usdc)).approve(address(router), sellAmt);
        uint256 dobBefore = ERC20(address(vault)).balanceOf(deployer);
        router.swap(buyZ4O, sellAmt, "");
        uint256 dobReceived = ERC20(address(vault)).balanceOf(deployer) - dobBefore;
        console2.log("[12] Buy during alert passed, dobRWA received:", dobReceived);

        // Recover price
        registry.emergencySetPrice(address(dct), 102_000e18);
        console2.log("[12] Price recovered to $102,000 (alert window still 1h)");
    }

    function _printSummary() internal view {
        console2.log("==============================================");
        console2.log("  Inari - deployed addresses");
        console2.log("==============================================");
        console2.log("  USDC             :", address(usdc));
        console2.log("  DCT              :", address(dct));
        console2.log("  ValidatorRegistry:", address(registry));
        console2.log("  RwaVault (dobRWA):", address(vault));
        console2.log("  LPRegistry       :", address(lpReg));
        console2.log("  InariPegHook     :", address(hook));
        console2.log("  SwapRouter       :", address(router));
        console2.log("==============================================");
    }
}
