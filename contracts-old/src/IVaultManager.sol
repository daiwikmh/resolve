// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice Vault that holds locked LP positions for vesting teams.
/// @dev setHook() is callable ONCE then permanently locked — no admin key after that.
interface IVaultManager {
    function depositPosition(address team, PoolId poolId, uint256 amount) external;
    function releasePosition(address team, PoolId poolId, uint256 amount, address to) external;
    function getLockedAmount(address team, PoolId poolId) external view returns (uint256);
    function setHook(address hook) external;
}
