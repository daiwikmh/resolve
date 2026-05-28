// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {ERC20} from "solmate/src/tokens/ERC20.sol";

import {InariValidatorRegistry} from "../src/InariValidatorRegistry.sol";
import {InariRwaVault} from "../src/InariRwaVault.sol";
import {InariPegHook} from "../src/InariPegHook.sol";
import {InariLPRegistry} from "../src/InariLPRegistry.sol";
import {RWAToken} from "../src/InariTokenFactory.sol";
import {MockUSDC} from "../src/RWAFaucet.sol";

/// @title DeployXLayer
/// @notice Single-shot deployment of the Inari (formerly Dobhooks) stack on X Layer mainnet.
///         Replaces the original Unichain Sepolia deploy. Drops all Reactive Network
///         components (ReactiveOracleSync + OracleAlertReceiver); price alerts are now
///         fired inline by InariValidatorRegistry on every setPrice() call.
///
/// Required env:
///   PRIVATE_KEY  uint256 -- deployer private key (with 0x prefix)
///
/// Optional env:
///   USDC          address -- existing USDC on X Layer (if set, skips MockUSDC deploy)
///   RWA_PRICE     uint256 -- initial RWA token price (default $100,000e18)
///   ALERT_PCT     uint256 -- alert threshold as % of initial price (default 70 -> 30% drop fires alert)
///
/// Usage:
///   PRIVATE_KEY=0x… forge script script/DeployXLayer.s.sol --rpc-url x_layer --broadcast -vvv
contract DeployXLayer is Script {
    /// @notice Uniswap v4 PoolManager on X Layer mainnet (chain ID 196).
    address constant X_LAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    /// @notice Canonical CREATE2 factory across all EVM chains.
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @notice Oracle staleness window -- matches what InariRwaVault uses.
    uint48 constant MAX_ORACLE_DELAY = 1 days;

    /// @notice Hook flag mask: beforeInitialize | beforeAddLiquidity | beforeSwap | beforeSwapReturnDelta = 0x2888
    uint160 constant HOOK_FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG
            | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
    );

    // Populated during run()
    MockUSDC public usdc;
    InariValidatorRegistry public registry;
    InariRwaVault public vault;
    InariLPRegistry public lpRegistry;
    InariPegHook public hook;
    RWAToken public dct; // Datacenter Token -- single demo RWA asset

    function run() public {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IPoolManager poolManager = IPoolManager(X_LAYER_POOL_MANAGER);

        uint256 rwaPrice = vm.envOr("RWA_PRICE", uint256(100_000e18));
        uint256 alertPct = vm.envOr("ALERT_PCT", uint256(70));
        uint256 alertThreshold = (rwaPrice * alertPct) / 100;

        console2.log("=========================================================");
        console2.log("  Inari Deployment - X Layer mainnet (chain 196)");
        console2.log("=========================================================");
        console2.log("Deployer:        ", deployer);
        console2.log("PoolManager:     ", X_LAYER_POOL_MANAGER);
        console2.log("RWA price:       ", rwaPrice);
        console2.log("Alert threshold: ", alertThreshold);
        console2.log("Hook flags:      0x2888");
        console2.log("---------------------------------------------------------");

        vm.startBroadcast(pk);

        // ─── Step 1: USDC ────────────────────────────────────────────────────
        // If USDC env is set, use it; otherwise deploy a mock with full mint to deployer.
        address usdcEnv = vm.envOr("USDC", address(0));
        ERC20 usdcRef;
        if (usdcEnv == address(0)) {
            usdc = new MockUSDC(deployer);
            usdcRef = ERC20(address(usdc));
            console2.log("[1] MockUSDC:    ", address(usdc));
        } else {
            usdcRef = ERC20(usdcEnv);
            console2.log("[1] USDC (env):  ", usdcEnv);
        }

        // ─── Step 2: Oracle registry ────────────────────────────────────────
        registry = new InariValidatorRegistry(deployer);
        console2.log("[2] Registry:    ", address(registry));

        // ─── Step 3: Vault ──────────────────────────────────────────────────
        vault = new InariRwaVault(address(registry), MAX_ORACLE_DELAY, deployer);
        console2.log("[3] Vault:       ", address(vault));

        // ─── Step 4: LP registry ────────────────────────────────────────────
        lpRegistry = new InariLPRegistry(address(usdcRef), deployer);
        console2.log("[4] LPRegistry:  ", address(lpRegistry));

        // ─── Step 5: Mine CREATE2 salt + deploy hook ────────────────────────
        bytes memory constructorArgs = abi.encode(
            poolManager,
            vault,
            usdcRef,
            registry,
            deployer
        );
        (address hookAddr, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            HOOK_FLAGS,
            type(InariPegHook).creationCode,
            constructorArgs
        );
        hook = new InariPegHook{salt: salt}(poolManager, vault, usdcRef, registry, deployer);
        require(address(hook) == hookAddr, "InariPegHook address mismatch");
        console2.log("[5] InariPegHook:", address(hook));
        console2.log("    salt:        ", uint256(salt));

        // ─── Step 6: Wire authorizations ────────────────────────────────────
        registry.setHook(address(hook));
        vault.setHook(address(hook));
        console2.log("[6] Wiring done -- registry.setHook + vault.setHook");

        // ─── Step 7: Demo RWA token + initial oracle data ───────────────────
        dct = new RWAToken("Datacenter Token", "DCT", 1_000_000e18, deployer, address(usdcRef));
        console2.log("[7] DCT token:   ", address(dct));

        registry.setPrice(address(dct), rwaPrice);
        registry.setAlertThreshold(address(dct), alertThreshold);
        console2.log("    price + alert threshold set");

        vault.addApprovedAsset(address(dct));
        console2.log("    DCT approved as vault asset");

        vm.stopBroadcast();

        // ─── Summary ────────────────────────────────────────────────────────
        console2.log("");
        console2.log("=========================================================");
        console2.log("  Deployed. Save these for the frontend:");
        console2.log("=========================================================");
        console2.log("USDC             :", address(usdcRef));
        console2.log("REGISTRY         :", address(registry));
        console2.log("VAULT            :", address(vault));
        console2.log("LP_REGISTRY      :", address(lpRegistry));
        console2.log("PEG_HOOK         :", address(hook));
        console2.log("DCT              :", address(dct));
        console2.log("=========================================================");
    }
}
