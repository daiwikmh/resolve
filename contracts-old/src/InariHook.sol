// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "./utils/BaseHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {VestingPosition, Milestone, ConditionType} from "./VestingTypes.sol";
import {IVaultManager} from "./IVaultManager.sol";

/// @title InariHook
/// @notice Uniswap v4 hook — performance-gated LP vesting on X Layer.
///         Teams register a vesting position with three milestones (TVL, Volume, Users).
///         Milestones unlock permissionlessly when on-chain metrics meet thresholds.
///         Rug-score is also evaluated permissionlessly; high scores trigger rage-lock.
///
/// Permissions: afterAddLiquidity | beforeRemoveLiquidity | afterSwap  =  0x0640
///
/// Single-chain design: no off-chain oracles, no cross-chain callbacks, no privileged
/// keeper. The hook owns its own ground-truth metrics and judges itself.
contract InariHook is BaseHook {
    using StateLibrary for IPoolManager;

    // =========================================================================
    // Errors
    // =========================================================================

    error UnlockPctSumNot100();
    error AlreadyRegistered();
    error PoolAlreadyClaimed(PoolId poolId);
    error ExceedsUnlockedAmount(uint256 requested, uint256 remaining);
    error InvalidMilestoneId();
    error MilestoneAlreadyComplete();
    error MilestoneThresholdNotMet(uint256 current, uint256 threshold);
    error TeamPoolMismatch();
    error NotRegistered();
    error CrashBrakeActive(uint256 until);
    error DrawdownBrakeActive(uint256 until);

    // =========================================================================
    // Events
    // =========================================================================

    event PositionRegistered(address indexed team, address indexed tokenAddr, PoolId indexed poolId);
    event PositionLocked(address indexed team, PoolId indexed poolId, uint256 amount);
    event PoolMetricsUpdated(PoolId indexed poolId, uint256 tvl, uint256 cumulativeVol, uint256 uniqueUsers);
    event MilestoneUnlocked(address indexed team, uint8 indexed milestoneId, uint8 newUnlockedPct);
    /// @notice Emitted inside afterSwap when a single swap drops price >=30%. Pauses team withdrawals.
    event CrashBrakeTriggered(PoolId indexed poolId, uint256 dropPct, uint256 until);
    /// @notice Emitted inside afterSwap when TVL falls >=50% from peak. Pauses team withdrawals.
    event DrawdownBrakeTriggered(PoolId indexed poolId, uint256 drawdownPct, uint256 until);

    // =========================================================================
    // Immutables
    // =========================================================================

    IVaultManager public immutable VAULT_MANAGER;

    // =========================================================================
    // Registration state
    // =========================================================================

    /// @dev positions[team] — team == address(0) means not registered.
    mapping(address => VestingPosition) public positions;
    /// @dev poolToTeam[poolId] — registered team for the pool.
    mapping(PoolId => address) public poolToTeam;
    /// @dev teamToPool[team] — reverse lookup so permissionless callers don't need to supply the pool.
    mapping(address => PoolId) public teamToPool;
    /// @dev Unlocked percentage (0..100) per team — gates withdrawals in beforeRemoveLiquidity.
    mapping(address => uint8) public unlockedPctByTeam;
    /// @dev Cumulative LP withdrawn per team. Enforces the unlocked-% cap across calls.
    mapping(address => uint256) public withdrawn;

    // =========================================================================
    // Telemetry state (updated in afterSwap)
    // =========================================================================

    mapping(PoolId => uint256) public cumulativeVolume;
    mapping(PoolId => uint256) public uniqueSwapperCount;
    mapping(PoolId => mapping(address => bool)) public hasSwapped;
    /// @dev Last swap price snapshot (sqrtPriceX96^2 >> 192). Used to detect single-swap crashes.
    mapping(PoolId => uint256) public lastPrice;
    /// @dev Peak TVL observed for this pool. Drives the drawdown brake.
    mapping(PoolId => uint256) public peakTvl;
    /// @dev Latest TVL snapshot from the most recent afterSwap.
    mapping(PoolId => uint256) public lastTvl;
    /// @dev block.timestamp until which team withdrawals are paused due to a >=30% single-swap crash.
    mapping(PoolId => uint256) public crashPauseUntil;
    /// @dev block.timestamp until which team withdrawals are paused due to >=50% TVL drawdown.
    mapping(PoolId => uint256) public drawdownPauseUntil;

    // =========================================================================
    // Brake constants — auto-activated inside afterSwap
    // =========================================================================

    /// @notice Single-swap price drop (percent) that triggers the crash brake.
    uint256 public constant CRASH_BRAKE_DROP_PCT = 30;
    /// @notice How long the crash brake pauses team withdrawals (short — MEV / sandwich defense).
    uint256 public constant CRASH_BRAKE_DURATION = 1 hours;
    /// @notice TVL drawdown from peak (percent) that triggers the drawdown brake.
    uint256 public constant DRAWDOWN_BRAKE_PCT = 50;
    /// @notice How long the drawdown brake pauses team withdrawals. Re-armed every swap that still observes drawdown.
    uint256 public constant DRAWDOWN_BRAKE_DURATION = 24 hours;

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(IPoolManager _manager, IVaultManager _vaultManager) BaseHook(_manager) {
        VAULT_MANAGER = _vaultManager;
    }

    /// @inheritdoc BaseHook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // =========================================================================
    // Registration
    // =========================================================================

    /// @notice Register a vesting position. Must be called BEFORE the team's first addLiquidity.
    /// @param milestones Three milestones (conditionType, threshold, unlockPct); unlockPct must sum to 100
    /// @param tokenAddr  Project token address (informational, surfaced in events)
    /// @param poolId     Pool ID the team will provide liquidity to (key.toId())
    function registerVestingPosition(
        Milestone[3] calldata milestones,
        address tokenAddr,
        PoolId poolId
    ) external {
        if (positions[msg.sender].team != address(0)) revert AlreadyRegistered();
        // Bug fix #1: prevent attacker from registering someone else's pool first.
        if (poolToTeam[poolId] != address(0)) revert PoolAlreadyClaimed(poolId);

        uint256 sum;
        for (uint256 i; i < 3; i++) {
            if (milestones[i].unlockPct == 0 || milestones[i].unlockPct > 100) revert UnlockPctSumNot100();
            sum += milestones[i].unlockPct;
        }
        if (sum != 100) revert UnlockPctSumNot100();

        VestingPosition storage pos = positions[msg.sender];
        pos.team = msg.sender;
        pos.tokenAddr = tokenAddr;
        pos.registeredAt = block.timestamp;
        for (uint256 j; j < 3; j++) {
            pos.milestones[j].conditionType = milestones[j].conditionType;
            pos.milestones[j].threshold = milestones[j].threshold;
            pos.milestones[j].unlockPct = milestones[j].unlockPct;
            pos.milestones[j].complete = false;
        }
        poolToTeam[poolId] = msg.sender;
        teamToPool[msg.sender] = poolId;

        emit PositionRegistered(msg.sender, tokenAddr, poolId);
    }

    // =========================================================================
    // Hook: afterAddLiquidity — record LP custody
    // =========================================================================

    function _afterAddLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, BalanceDelta) {
        PoolId poolId = key.toId();
        address team = poolToTeam[poolId];

        // Unregistered pool — pass through.
        if (team == address(0) || positions[team].team == address(0)) {
            return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        uint256 lpAmount = _calcLpFromDelta(params);
        if (lpAmount == 0) {
            return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
        }

        VAULT_MANAGER.depositPosition(team, poolId, lpAmount);
        positions[team].lpAmount += lpAmount;

        emit PositionLocked(team, poolId, lpAmount);
        return (this.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }

    function _calcLpFromDelta(ModifyLiquidityParams calldata params) internal pure returns (uint256) {
        if (params.liquidityDelta <= 0) return 0;
        return uint256(params.liquidityDelta);
    }

    // =========================================================================
    // Hook: beforeRemoveLiquidity — gate by auto-brakes + unlocked %
    // =========================================================================

    /// @dev Non-view: tracks cumulative withdrawal so the unlocked-% cap holds across calls.
    ///      State changes here revert with the rest of the tx if PoolManager later fails.
    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) internal override returns (bytes4) {
        PoolId poolId = key.toId();
        address team = poolToTeam[poolId];

        if (team == address(0) || positions[team].team == address(0)) {
            return this.beforeRemoveLiquidity.selector;
        }

        // Auto-brakes set by afterSwap. No external trigger, no external caller.
        uint256 crashUntil = crashPauseUntil[poolId];
        if (crashUntil > block.timestamp) revert CrashBrakeActive(crashUntil);

        uint256 drawdownUntil = drawdownPauseUntil[poolId];
        if (drawdownUntil > block.timestamp) revert DrawdownBrakeActive(drawdownUntil);

        uint256 lpAmount = positions[team].lpAmount;
        uint256 maxWithdrawable = (lpAmount * unlockedPctByTeam[team]) / 100;
        uint256 already = withdrawn[team];
        uint256 remaining = already >= maxWithdrawable ? 0 : maxWithdrawable - already;

        uint256 requested = params.liquidityDelta < 0 ? uint256(-params.liquidityDelta) : uint256(params.liquidityDelta);
        if (requested > remaining) {
            revert ExceedsUnlockedAmount(requested, remaining);
        }
        withdrawn[team] = already + requested;

        return this.beforeRemoveLiquidity.selector;
    }

    // =========================================================================
    // Hook: afterSwap — metrics + auto-brakes (crash + drawdown)
    // =========================================================================

    /// @dev Reads ground truth from PoolManager via StateLibrary. Auto-activates the
    ///      crash brake on a single-swap >=30% price drop and the drawdown brake
    ///      on >=50% TVL fall from peak. Both brakes are pool-scoped and time-bounded.
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Resolve the real actor (router swaps obscure tx.origin behind the router contract).
        address actor = sender;
        if (hookData.length == 32) {
            actor = abi.decode(hookData, (address));
            if (actor == address(0)) actor = tx.origin;
        } else if (sender != tx.origin) {
            actor = tx.origin;
        }

        uint256 swapAmt = _abs128(BalanceDeltaLibrary.amount0(delta)) + _abs128(BalanceDeltaLibrary.amount1(delta));
        cumulativeVolume[poolId] += swapAmt;

        if (!hasSwapped[poolId][actor]) {
            uniqueSwapperCount[poolId]++;
            hasSwapped[poolId][actor] = true;
        }

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        uint256 tvl = (uint256(liquidity) * uint256(sqrtPriceX96)) >> 96;
        lastTvl[poolId] = tvl;
        if (tvl > peakTvl[poolId]) peakTvl[poolId] = tvl;

        // ── Crash brake — single-swap >=30% price drop ────────────────────────
        uint256 currentPrice = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
        uint256 prev = lastPrice[poolId];
        if (prev > 0 && currentPrice < prev) {
            uint256 drop = (prev - currentPrice) * 100 / prev;
            if (drop >= CRASH_BRAKE_DROP_PCT) {
                uint256 until = block.timestamp + CRASH_BRAKE_DURATION;
                crashPauseUntil[poolId] = until;
                emit CrashBrakeTriggered(poolId, drop, until);
            }
        }
        lastPrice[poolId] = currentPrice;

        // ── Drawdown brake — TVL >=50% below peak ─────────────────────────────
        uint256 peak = peakTvl[poolId];
        if (peak > 0 && tvl < peak) {
            uint256 drawdown = (peak - tvl) * 100 / peak;
            if (drawdown >= DRAWDOWN_BRAKE_PCT) {
                uint256 until = block.timestamp + DRAWDOWN_BRAKE_DURATION;
                drawdownPauseUntil[poolId] = until;
                emit DrawdownBrakeTriggered(poolId, drawdown, until);
            }
        }

        emit PoolMetricsUpdated(poolId, tvl, cumulativeVolume[poolId], uniqueSwapperCount[poolId]);

        return (this.afterSwap.selector, 0);
    }

    function _abs128(int128 x) internal pure returns (uint256) {
        return x < 0 ? uint256(uint128(-x)) : uint256(uint128(x));
    }

    // =========================================================================
    // Permissionless milestone unlock (replaces RSC authorizeUnlock)
    // =========================================================================

    /// @notice Anyone may call this. Marks the milestone complete and bumps the
    ///         team's unlocked percentage IFF the on-chain metric meets the
    ///         registered threshold. No off-chain oracle, no privileged caller.
    function claimMilestoneUnlock(address team, uint8 milestoneId) external {
        if (milestoneId >= 3) revert InvalidMilestoneId();
        VestingPosition storage pos = positions[team];
        if (pos.team == address(0)) revert NotRegistered();

        Milestone storage m = pos.milestones[milestoneId];
        if (m.complete) revert MilestoneAlreadyComplete();

        PoolId poolId = teamToPool[team];
        uint256 currentMetric = _readMetric(poolId, m.conditionType);
        if (currentMetric < m.threshold) {
            revert MilestoneThresholdNotMet(currentMetric, m.threshold);
        }

        m.complete = true;
        uint256 newPct = uint256(unlockedPctByTeam[team]) + uint256(m.unlockPct);
        if (newPct > 100) newPct = 100;
        unlockedPctByTeam[team] = uint8(newPct);

        emit MilestoneUnlocked(team, milestoneId, uint8(newPct));
    }

    function _readMetric(PoolId poolId, ConditionType c) internal view returns (uint256) {
        if (c == ConditionType.TVL) return lastTvl[poolId];
        if (c == ConditionType.Vol) return cumulativeVolume[poolId];
        return uniqueSwapperCount[poolId];
    }

    // =========================================================================
    // Views
    // =========================================================================

    function getLockedAmount(address team, PoolId poolId) external view returns (uint256) {
        if (poolToTeam[poolId] != team) return 0;
        return positions[team].lpAmount;
    }

    function getMilestone(address team, uint8 milestoneId) external view returns (Milestone memory) {
        require(milestoneId < 3, "bad id");
        return positions[team].milestones[milestoneId];
    }
}
