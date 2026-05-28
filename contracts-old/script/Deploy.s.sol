// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

import {InariHook} from "../src/InariHook.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {IVaultManager} from "../src/IVaultManager.sol";
import {HookMiner} from "./HookMiner.sol";

/// @title Deploy
/// @notice Deploys VaultManager + InariHook on X Layer mainnet (chain 196).
///
/// Required env:
///   PRIVATE_KEY   uint256 — deployer private key (hex)
///
/// Optional env:
///   POOL_MANAGER  address — override the X Layer PoolManager (default below)
///
/// Hook flags 0x0640:
///   afterAddLiquidity      (bit 10) = 0x0400
///   beforeRemoveLiquidity  (bit 9)  = 0x0200
///   afterSwap              (bit 6)  = 0x0040
///
/// Usage:
///   PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url x_layer --broadcast -vvvv
contract Deploy is Script {
    /// @notice X Layer mainnet PoolManager (chain ID 196).
    address constant X_LAYER_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;

    /// @notice InariHook permission flag mask.
    uint160 constant HOOK_FLAGS = uint160(0x0640);

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        IPoolManager poolManager = IPoolManager(vm.envOr("POOL_MANAGER", X_LAYER_POOL_MANAGER));

        uint64 nonce = vm.getNonce(deployer);
        address predictedVault = vm.computeCreateAddress(deployer, nonce);

        console.log("======================================================");
        console.log("  Inari Deployment (X Layer mainnet, chain ID 196)");
        console.log("======================================================");
        console.log("Deployer:          ", deployer);
        console.log("Current nonce:     ", nonce);
        console.log("PoolManager:       ", address(poolManager));
        console.log("Predicted Vault:   ", predictedVault);

        // Mine the CREATE2 salt for the hook against the predicted vault address.
        bytes memory initCode = abi.encodePacked(
            type(InariHook).creationCode,
            abi.encode(poolManager, IVaultManager(predictedVault))
        );

        console.log("");
        console.log("Mining CREATE2 salt (target flags: 0x0640)...");
        (address hookAddr, bytes32 salt) = HookMiner.find(CREATE2_FACTORY, HOOK_FLAGS, initCode);

        console.log("Mined InariHook:   ", hookAddr);
        console.logBytes32(salt);

        require(
            uint160(hookAddr) & uint160(0x3FFF) == HOOK_FLAGS,
            "FATAL: mined address flag mismatch"
        );

        // ── Broadcast ────────────────────────────────────────────────────────
        console.log("");
        console.log("--- Deploying ---");

        vm.startBroadcast(pk);

        // tx0 (nonce n): VaultManager
        VaultManager vault = new VaultManager();
        require(address(vault) == predictedVault, "VaultManager address mismatch");
        console.log("[tx0] VaultManager: ", address(vault));

        // tx1 (nonce n+1): InariHook via CREATE2
        InariHook hook = new InariHook{salt: salt}(poolManager, IVaultManager(address(vault)));
        require(address(hook) == hookAddr, "InariHook address mismatch");
        console.log("[tx1] InariHook:    ", address(hook));

        // tx2 (nonce n+2): one-shot wire — vault learns the hook, then setHook is permanently locked.
        vault.setHook(address(hook));
        console.log("[tx2] vault.setHook() done");

        vm.stopBroadcast();

        console.log("");
        console.log("======================================================");
        console.log("  Deployment complete");
        console.log("======================================================");
        console.log("VAULT_MANAGER = ", address(vault));
        console.log("INARI_HOOK    = ", address(hook));
    }
}
