// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HookMiner
/// @notice Brute-forces a CREATE2 salt so the deployed v4 hook address encodes the
///         required permission flags in its lower 14 bits.
/// @dev Address invariant:  uint160(hookAddress) & 0x3FFF == flags
library HookMiner {
    /// @param deployer     CREATE2 factory address (Foundry's CREATE2_FACTORY when broadcasting)
    /// @param flags        Required permission bits (e.g. 0x0640 for after-add/before-remove/after-swap)
    /// @param creationCode Full init code: abi.encodePacked(type(Hook).creationCode, abi.encode(args))
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode
    ) internal pure returns (address hookAddress, bytes32 salt) {
        uint160 mask = uint160(0x3FFF);
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 500_000; i++) {
            salt = bytes32(i);
            hookAddress = address(
                uint160(
                    uint256(
                        keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash))
                    )
                )
            );
            if (uint160(hookAddress) & mask == flags) {
                return (hookAddress, salt);
            }
        }
        revert("HookMiner: no valid salt found in 500k iterations");
    }
}
