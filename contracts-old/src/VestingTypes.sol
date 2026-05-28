// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Condition type for vesting milestones (0=TVL, 1=Vol, 2=Users)
enum ConditionType {
    TVL,
    Vol,
    Users
}

/// @notice A single vesting milestone, evaluated permissionlessly on-chain.
/// @param conditionType 0=TVL, 1=Vol, 2=Users
/// @param threshold     Target value the metric must reach
/// @param unlockPct     Percentage to unlock when met (1..100)
/// @param complete      True once anyone has called claimMilestoneUnlock and the threshold was met
struct Milestone {
    ConditionType conditionType;
    uint256 threshold;
    uint8 unlockPct;
    bool complete;
}

/// @notice Registered vesting position for a team.
/// @param team          Team wallet (address(0) means not registered)
/// @param tokenAddr     Project token address (informational)
/// @param milestones    Three milestones; unlockPct must sum to 100
/// @param lpAmount      Total LP amount locked in vault
/// @param registeredAt  block.timestamp at registration
struct VestingPosition {
    address team;
    address tokenAddr;
    Milestone[3] milestones;
    uint256 lpAmount;
    uint256 registeredAt;
}
