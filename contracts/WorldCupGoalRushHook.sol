// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WorldCupGoalRushHook v2
 * @notice OKX X Layer Mainnet — GoalRush Prediction Jackpot
 *
 * Changes from v1:
 *  - platformFeeBps (2% default): 2% of each jackpot claim goes to owner
 *  - createMatch now takes _kickoffTime (unix timestamp) instead of _duration
 *    so predictions open IMMEDIATELY upon match creation (days in advance)
 *    and close 110 minutes after actual kickoff — like Polymarket but on-chain
 *  - Match struct gains kickoffTime field for frontend countdown
 */

interface IPoolManager {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
}

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct BeforeSwapDelta {
    int128 delta0;
    int128 delta1;
}

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
}

contract WorldCupGoalRushHook {
    // ─── Uniswap V4 ───────────────────────────────────────────
    address public immutable poolManager;

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "Only PoolManager");
        _;
    }

    // ─── Match State ──────────────────────────────────────────
    struct Match {
        uint256 id;
        string  teamA;
        string  teamB;
        uint256 startTime;    // block.timestamp when match was registered on-chain
        uint256 kickoffTime;  // actual real-world kickoff timestamp (from ESPN)
        uint256 endTime;      // kickoffTime + 110 min — predictions close here
        bool    resolved;
        uint8   winner;       // 1=TeamA, 2=TeamB, 3=Draw
        uint256 totalJackpot;
        uint256 totalPredictionVolume;
    }

    struct Prediction {
        uint256 ethAmount;
        uint256 grushAmount;
        bool    ethClaimed;
        bool    grushClaimed;
    }

    // ─── Config ───────────────────────────────────────────────
    address public owner;
    address public predictionRouter;
    IERC20  public grushToken;

    /// @notice Platform fee in basis points (200 = 2%).  Max 500 (5%).
    uint256 public platformFeeBps = 200;

    uint256 public activeMatchId;

    // ─── Storage ──────────────────────────────────────────────
    mapping(uint256 => Match)    public matches;
    mapping(uint256 => mapping(address => mapping(uint8 => Prediction))) public predictions;
    mapping(uint256 => mapping(uint8  => uint256)) public teamPredictionVolume;
    mapping(uint256 => mapping(uint8  => uint256)) public teamGrushPredictionVolume;
    mapping(uint256 => uint256) public matchGrushJackpot;
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public swapPredictionVolume;
    mapping(uint256 => uint256) public matchOkbClaimedPayout;
    mapping(uint256 => uint256) public matchOkbClaimedWinnerVolume;

    uint256 public totalEthLiability;
    bool private entered;

    // ─── Goal Rush ────────────────────────────────────────────
    uint256 public goalRushChance = 5;
    uint256 public totalGoalsScored;
    mapping(address => uint256) public userGoals;

    // ─── Events ───────────────────────────────────────────────
    event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 kickoffTime);
    event MatchResolved(uint256 indexed matchId, uint8 winner, uint256 jackpotAmount);
    event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event GrushPredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event GoalScored(address indexed swapper, uint256 bonusAmount);
    event JackpotClaimed(address indexed user, uint256 indexed matchId, uint256 userPayout, uint256 fee);
    event GrushJackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount);
    event PredictionRouterUpdated(address indexed router);
    event GrushTokenUpdated(address indexed token);
    event SwapPredictionObserved(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event PlatformFeeUpdated(uint256 newFeeBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    modifier onlyPredictionRouter() {
        require(msg.sender == predictionRouter, "Only PredictionRouter");
        _;
    }

    modifier nonReentrant() {
        require(!entered, "Reentrant call");
        entered = true;
        _;
        entered = false;
    }

    // ─── Constructor ──────────────────────────────────────────
    constructor(address _poolManager) {
        require(_poolManager != address(0), "PoolManager cannot be zero");
        poolManager = _poolManager;
        owner = msg.sender;
    }

    // ─── Uniswap V4 Callbacks ─────────────────────────────────

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta memory, uint24) {
        if (hookData.length == 64 && activeMatchId > 0) {
            Match storage activeMatch = matches[activeMatchId];
            if (!activeMatch.resolved && block.timestamp < activeMatch.endTime) {
                (uint8 predictedTeam, address swapper) = abi.decode(hookData, (uint8, address));
                if (swapper != address(0) && (predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3)) {
                    uint256 swapAmount = params.amountSpecified > 0
                        ? uint256(params.amountSpecified)
                        : uint256(-params.amountSpecified);
                    swapPredictionVolume[activeMatchId][swapper][predictedTeam] += swapAmount;
                    emit SwapPredictionObserved(swapper, activeMatchId, predictedTeam, swapAmount);
                }
            }
        }
        return (this.beforeSwap.selector, BeforeSwapDelta(0, 0), 0);
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        int128 delta0,
        int128 delta1,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        uint256 randVal = uint256(keccak256(abi.encodePacked(
            block.timestamp, sender, delta0, delta1
        ))) % 100;
        if (randVal < goalRushChance) {
            address swapper = sender;
            if (hookData.length == 64) {
                (, swapper) = abi.decode(hookData, (uint8, address));
            }
            totalGoalsScored++;
            userGoals[swapper]++;
            emit GoalScored(swapper, 10000000000000000);
        }
        return (this.afterSwap.selector, 0);
    }

    // ─── Admin: Match Lifecycle ────────────────────────────────

    /**
     * @notice Register a match. Predictions open immediately and close 110 min after kickoff.
     * @param _matchId      Deterministic ID (keccak256 of ESPN event ID)
     * @param _teamA        Home team name
     * @param _teamB        Away team name
     * @param _kickoffTime  Unix timestamp of the actual match kickoff
     */
    function createMatch(
        uint256 _matchId,
        string  calldata _teamA,
        string  calldata _teamB,
        uint256 _kickoffTime
    ) external onlyOwner {
        require(matches[_matchId].id == 0, "Match already exists");

        // If kickoff already passed (e.g., match is already live), use now as base
        uint256 effectiveKickoff = _kickoffTime > block.timestamp
            ? _kickoffTime
            : block.timestamp;
        uint256 endTime = effectiveKickoff + 110 * 60;

        matches[_matchId] = Match({
            id:                   _matchId,
            teamA:                _teamA,
            teamB:                _teamB,
            startTime:            block.timestamp,
            kickoffTime:          effectiveKickoff,
            endTime:              endTime,
            resolved:             false,
            winner:               0,
            totalJackpot:         0,
            totalPredictionVolume: 0
        });

        activeMatchId = _matchId;
        emit MatchCreated(_matchId, _teamA, _teamB, effectiveKickoff);
    }

    function setActiveMatchId(uint256 _matchId) external onlyOwner {
        require(matches[_matchId].id != 0, "Match does not exist");
        activeMatchId = _matchId;
    }

    function resolveMatch(uint256 _matchId, uint8 _winner) external onlyOwner {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.id != 0, "Match does not exist");
        require(!targetMatch.resolved, "Match already resolved");
        require(_winner <= 3, "Invalid winner");

        targetMatch.resolved = true;
        targetMatch.winner   = _winner;

        if (teamPredictionVolume[_matchId][_winner] == 0) {
            totalEthLiability -= targetMatch.totalJackpot;
        }

        emit MatchResolved(_matchId, _winner, targetMatch.totalJackpot);
    }

    // ─── Predictions (called by router) ───────────────────────

    function placeEthPredictionFor(
        uint256 _matchId,
        address user,
        uint8   predictedTeam
    ) external payable onlyPredictionRouter {
        require(msg.value > 0, "Prediction amount required");
        _recordEthPrediction(_matchId, user, predictedTeam, msg.value);
        totalEthLiability += msg.value;
    }

    function placeGrushPredictionFor(
        uint256 _matchId,
        address user,
        uint8   predictedTeam,
        uint256 amount
    ) external onlyPredictionRouter {
        require(amount > 0, "Prediction amount required");
        _recordGrushPrediction(_matchId, user, predictedTeam, amount);
    }

    function _recordEthPrediction(
        uint256 matchId,
        address user,
        uint8   predictedTeam,
        uint256 volume
    ) internal {
        require(matchId > 0, "No active match");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");

        Match storage m = matches[matchId];
        require(m.id != 0,          "Match does not exist");
        require(!m.resolved,         "Match already resolved");
        require(block.timestamp < m.endTime, "Predictions closed");

        predictions[matchId][user][predictedTeam].ethAmount += volume;
        teamPredictionVolume[matchId][predictedTeam]        += volume;
        m.totalPredictionVolume                             += volume;
        m.totalJackpot                                      += volume;

        emit PredictionPlaced(user, matchId, predictedTeam, volume);
    }

    function _recordGrushPrediction(
        uint256 matchId,
        address user,
        uint8   predictedTeam,
        uint256 amount
    ) internal {
        require(matchId > 0, "No active match");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");

        Match storage m = matches[matchId];
        require(m.id != 0,          "Match does not exist");
        require(!m.resolved,         "Match already resolved");
        require(block.timestamp < m.endTime, "Predictions closed");

        predictions[matchId][user][predictedTeam].grushAmount += amount;
        teamGrushPredictionVolume[matchId][predictedTeam]     += amount;
        matchGrushJackpot[matchId]                            += amount;

        emit GrushPredictionPlaced(user, matchId, predictedTeam, amount);
    }

    // ─── Claims ───────────────────────────────────────────────

    /**
     * @notice Claim OKB jackpot. A 2% platform fee is deducted at claim time.
     */
    function claimJackpot(uint256 _matchId) external nonReentrant {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");

        Prediction storage pred = predictions[_matchId][msg.sender][targetMatch.winner];
        require(pred.ethAmount > 0,  "No ETH prediction on winning team");
        require(!pred.ethClaimed,    "ETH jackpot already claimed");

        pred.ethClaimed = true;

        uint256 winnerVolume = teamPredictionVolume[_matchId][targetMatch.winner];
        require(winnerVolume > 0, "No winning volume");

        // Gross claim share
        uint256 grossClaim = (pred.ethAmount * targetMatch.totalJackpot) / winnerVolume;

        // Platform fee (2%)
        uint256 fee        = (grossClaim * platformFeeBps) / 10_000;
        uint256 userPayout = grossClaim - fee;

        // Track accounting
        matchOkbClaimedPayout[_matchId]       += grossClaim;
        matchOkbClaimedWinnerVolume[_matchId] += pred.ethAmount;
        totalEthLiability                     -= grossClaim;

        // Release integer-division dust on the last claim
        if (matchOkbClaimedWinnerVolume[_matchId] == winnerVolume) {
            uint256 dust = targetMatch.totalJackpot - matchOkbClaimedPayout[_matchId];
            totalEthLiability -= dust;
        }

        // Send fee to owner treasury
        if (fee > 0) {
            (bool feeOk, ) = payable(owner).call{value: fee}("");
            require(feeOk, "Fee transfer failed");
        }

        // Send winnings to user
        (bool ok, ) = payable(msg.sender).call{value: userPayout}("");
        require(ok, "Jackpot transfer failed");

        emit JackpotClaimed(msg.sender, _matchId, userPayout, fee);
    }

    function claimGrushJackpot(uint256 _matchId) external nonReentrant {
        require(address(grushToken) != address(0), "GRUSH token not set");

        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");

        Prediction storage pred = predictions[_matchId][msg.sender][targetMatch.winner];
        require(pred.grushAmount > 0, "No GRUSH prediction on winning team");
        require(!pred.grushClaimed,   "GRUSH jackpot already claimed");

        pred.grushClaimed = true;

        uint256 winnerVolume = teamGrushPredictionVolume[_matchId][targetMatch.winner];
        require(winnerVolume > 0, "No winning GRUSH volume");

        uint256 claimAmount = (pred.grushAmount * matchGrushJackpot[_matchId]) / winnerVolume;
        require(grushToken.transfer(msg.sender, claimAmount), "GRUSH transfer failed");

        emit GrushJackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    // ─── View Functions ───────────────────────────────────────

    function getUserPredictions(uint256 _matchId, address _user) external view returns (
        uint256[4] memory ethAmounts,
        uint256[4] memory grushAmounts,
        bool[4]    memory ethClaimeds,
        bool[4]    memory grushClaimeds
    ) {
        for (uint8 i = 1; i <= 3; i++) {
            Prediction storage pred = predictions[_matchId][_user][i];
            ethAmounts[i]   = pred.ethAmount;
            grushAmounts[i] = pred.grushAmount;
            ethClaimeds[i]  = pred.ethClaimed;
            grushClaimeds[i]= pred.grushClaimed;
        }
    }

    // ─── Admin ────────────────────────────────────────────────

    receive() external payable {}

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= totalEthLiability, "Contract is underfunded");
        require(amount <= address(this).balance - totalEthLiability, "Amount reserved for jackpots");
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function setPredictionRouter(address _router) external onlyOwner {
        require(_router.code.length > 0, "Router must be a contract");
        predictionRouter = _router;
        emit PredictionRouterUpdated(_router);
    }

    function setGrushToken(address _token) external onlyOwner {
        require(_token.code.length > 0, "Token must be a contract");
        grushToken = IERC20(_token);
        emit GrushTokenUpdated(_token);
    }

    function setGoalRushChance(uint256 _chance) external onlyOwner {
        require(_chance <= 100, "Chance too high");
        goalRushChance = _chance;
    }

    /// @notice Adjust platform fee. Max 5% (500 bps).
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 500, "Max fee is 5%");
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(_feeBps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
