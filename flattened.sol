// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File contracts/WorldCupGoalRushHook.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WorldCupGoalRushHook
 * @notice A Uniswap V4 Hook designed for the OKX X Layer "Hook the World Cup" Hackathon.
 * It integrates a World Cup Match Prediction Jackpot and a gamified "Goal Rush" swap rebate.
 * 
 * Features:
 * 1. World Cup Jackpot: A percentage of each swap fee is sent to a jackpot pool. Users can
 *    predict the winner of the active World Cup match via `hookData`. Correct predictions
 *    share the jackpot when the match is resolved.
 * 2. Goal Rush Rebate: Swaps have a random chance (e.g., 5%) to score a "Goal", which triggers
 *    an immediate fee rebate or cashback reward from the pool.
 */

// Custom minimal interfaces to avoid external dependency compilation errors in local environments
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
    // --- Uniswap V4 Hooks Standards ---
    address public immutable poolManager;

    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "Only PoolManager");
        _;
    }

    // --- World Cup State ---
    struct Match {
        uint256 id;
        string teamA;
        string teamB;
        uint256 startTime;
        uint256 endTime;
        bool resolved;
        uint8 winner; // 0 = None/Draw, 1 = TeamA, 2 = TeamB
        uint256 totalJackpot;
        uint256 totalPredictionVolume;
    }

    struct Prediction {
        uint256 okbAmount;
        uint256 grushAmount;
        bool okbClaimed;
        bool grushClaimed;
    }

    address public owner;
    address public predictionRouter;
    IERC20 public grushToken;
    uint256 public activeMatchId;
    mapping(uint256 => Match) public matches;
    // matchId => user => teamId => Prediction
    mapping(uint256 => mapping(address => mapping(uint8 => Prediction))) public predictions;
    // matchId => teamId => total prediction volume
    mapping(uint256 => mapping(uint8 => uint256)) public teamPredictionVolume;
    mapping(uint256 => mapping(uint8 => uint256)) public teamGrushPredictionVolume;
    mapping(uint256 => uint256) public matchGrushJackpot;
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public swapPredictionVolume;
    mapping(uint256 => uint256) public matchOkbClaimedPayout;
    mapping(uint256 => uint256) public matchOkbClaimedWinnerVolume;
    uint256 public totalOkbLiability;
    bool private entered;

    // --- Gamified Goal Rush State ---
    uint256 public goalRushChance = 5; // 5% chance
    uint256 public totalGoalsScored;
    mapping(address => uint256) public userGoals;
    
    // --- Events ---
    event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 startTime);
    event MatchResolved(uint256 indexed matchId, uint8 winner, uint256 jackpotAmount);
    event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event GrushPredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);
    event GoalScored(address indexed swapper, uint256 bonusAmount);
    event JackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount);
    event GrushJackpotClaimed(address indexed user, uint256 indexed matchId, uint256 amount);
    event PredictionRouterUpdated(address indexed router);
    event GrushTokenUpdated(address indexed token);
    event SwapPredictionObserved(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume);

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

    constructor(address _poolManager) {
        require(_poolManager != address(0), "PoolManager cannot be zero");
        poolManager = _poolManager;
        owner = msg.sender;
    }

    // --- Uniswap V4 Callbacks ---

    /**
     * @notice Callback before a swap occurs.
     * Extracts prediction data from hookData and registers the prediction volume.
     */
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta memory, uint24) {
        // Parse hookData for World Cup prediction if provided
        // Format: abi.encode(predictedTeamId, swapperAddress)
        if (hookData.length == 64 && activeMatchId > 0) {
            Match storage activeMatch = matches[activeMatchId];
            if (!activeMatch.resolved && block.timestamp < activeMatch.endTime) {
                (uint8 predictedTeam, address swapper) = abi.decode(hookData, (uint8, address));

                if (swapper != address(0) && (predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3)) {
                    uint256 swapAmount = params.amountSpecified > 0 
                        ? uint256(params.amountSpecified) 
                        : uint256(-params.amountSpecified);

                    // Swap volume is informational only. It is not a funded jackpot deposit and
                    // therefore must never create a claim against other users' deposited OKB.
                    swapPredictionVolume[activeMatchId][swapper][predictedTeam] += swapAmount;
                    emit SwapPredictionObserved(swapper, activeMatchId, predictedTeam, swapAmount);
                }
            }
        }

        // Return the function selector to validate hook execution
        // and 0 for delta overrides (standard Uniswap V4 behavior)
        // 0 returned for lpFeeOverride to use the pool's default fee
        return (this.beforeSwap.selector, BeforeSwapDelta(0, 0), 0);
    }

    /**
     * @notice Callback after a swap occurs.
     * Evaluates the Goal Rush rebate chance.
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        int128 delta0,
        int128 delta1,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        // Goal Rush: Check if the user scores a goal (pseudo-random chance)
        uint256 randVal = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            sender, 
            delta0, 
            delta1
        ))) % 100;

        if (randVal < goalRushChance) {
            address swapper = sender;
            if (hookData.length == 64) {
                // Decode swapper address from hookData if passed
                (, swapper) = abi.decode(hookData, (uint8, address));
            }
            
            totalGoalsScored++;
            userGoals[swapper]++;

            // Simulate sending a goal reward rebate (e.g., 0.01 ETH worth of tokens)
            emit GoalScored(swapper, 10000000000000000); // 0.01 ether mock reward
        }

        return (this.afterSwap.selector, 0);
    }

    // --- World Cup Admin Functions ---

    function createMatch(
        uint256 _matchId,
        string calldata _teamA,
        string calldata _teamB,
        uint256 _duration
    ) external onlyOwner {
        require(matches[_matchId].id == 0, "Match already exists");
        
        matches[_matchId] = Match({
            id: _matchId,
            teamA: _teamA,
            teamB: _teamB,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            resolved: false,
            winner: 0,
            totalJackpot: 0,
            totalPredictionVolume: 0
        });

        activeMatchId = _matchId;
        emit MatchCreated(_matchId, _teamA, _teamB, block.timestamp);
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
        targetMatch.winner = _winner;

        // With no winning deposits there can be no claims, so the match funds become excess.
        if (teamPredictionVolume[_matchId][_winner] == 0) {
            totalOkbLiability -= targetMatch.totalJackpot;
        }

        emit MatchResolved(_matchId, _winner, targetMatch.totalJackpot);
    }

    // --- User Claim Functions ---

    function placeOkbPredictionFor(uint256 _matchId, address user, uint8 predictedTeam) external payable onlyPredictionRouter {
        require(msg.value > 0, "Prediction amount required");
        _recordOkbPrediction(_matchId, user, predictedTeam, msg.value, msg.value);
        totalOkbLiability += msg.value;
    }

    function placeGrushPredictionFor(uint256 _matchId, address user, uint8 predictedTeam, uint256 amount) external onlyPredictionRouter {
        require(amount > 0, "Prediction amount required");
        _recordGrushPrediction(_matchId, user, predictedTeam, amount);
    }

    function _recordOkbPrediction(
        uint256 matchId,
        address user,
        uint8 predictedTeam,
        uint256 volume,
        uint256 jackpotContribution
    ) internal {
        require(matchId > 0, "No active match");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");

        Match storage activeMatch = matches[matchId];
        require(activeMatch.id != 0, "Match does not exist");
        require(!activeMatch.resolved, "Match already resolved");
        require(block.timestamp < activeMatch.endTime, "Predictions closed");

        Prediction storage pred = predictions[matchId][user][predictedTeam];
        pred.okbAmount += volume;

        teamPredictionVolume[matchId][predictedTeam] += volume;
        activeMatch.totalPredictionVolume += volume;
        activeMatch.totalJackpot += jackpotContribution;

        emit PredictionPlaced(user, matchId, predictedTeam, volume);
    }

    function _recordGrushPrediction(uint256 matchId, address user, uint8 predictedTeam, uint256 amount) internal {
        require(matchId > 0, "No active match");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");

        Match storage activeMatch = matches[matchId];
        require(activeMatch.id != 0, "Match does not exist");
        require(!activeMatch.resolved, "Match already resolved");
        require(block.timestamp < activeMatch.endTime, "Predictions closed");

        Prediction storage pred = predictions[matchId][user][predictedTeam];
        pred.grushAmount += amount;

        teamGrushPredictionVolume[matchId][predictedTeam] += amount;
        matchGrushJackpot[matchId] += amount;

        emit GrushPredictionPlaced(user, matchId, predictedTeam, amount);
    }

    /**
     * @notice Claim native OKB prediction jackpot shares for a resolved match.
     */
    function claimJackpot(uint256 _matchId) external nonReentrant {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");
        
        Prediction storage pred = predictions[_matchId][msg.sender][targetMatch.winner];
        require(pred.okbAmount > 0, "No OKB prediction made for winning team");
        require(!pred.okbClaimed, "OKB jackpot already claimed");

        pred.okbClaimed = true;

        uint256 winnerVolume = teamPredictionVolume[_matchId][targetMatch.winner];
        require(winnerVolume > 0, "No winning OKB volume");
        uint256 claimAmount = (pred.okbAmount * targetMatch.totalJackpot) / winnerVolume;

        matchOkbClaimedPayout[_matchId] += claimAmount;
        matchOkbClaimedWinnerVolume[_matchId] += pred.okbAmount;
        totalOkbLiability -= claimAmount;

        // Release any final integer-division dust after the last winning stake claims.
        if (matchOkbClaimedWinnerVolume[_matchId] == winnerVolume) {
            uint256 dust = targetMatch.totalJackpot - matchOkbClaimedPayout[_matchId];
            totalOkbLiability -= dust;
        }

        (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
        require(success, "Jackpot transfer failed");

        emit JackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    function claimGrushJackpot(uint256 _matchId) external nonReentrant {
        require(address(grushToken) != address(0), "GRUSH token not set");

        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");
        
        Prediction storage pred = predictions[_matchId][msg.sender][targetMatch.winner];
        require(pred.grushAmount > 0, "No GRUSH prediction made for winning team");
        require(!pred.grushClaimed, "GRUSH jackpot already claimed");

        pred.grushClaimed = true;

        uint256 winnerVolume = teamGrushPredictionVolume[_matchId][targetMatch.winner];
        require(winnerVolume > 0, "No winning GRUSH volume");
        uint256 claimAmount = (pred.grushAmount * matchGrushJackpot[_matchId]) / winnerVolume;

        require(grushToken.transfer(msg.sender, claimAmount), "GRUSH transfer failed");

        emit GrushJackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    /**
     * @notice Get all predictions for a user on a given match.
     */
    function getUserPredictions(uint256 _matchId, address _user) external view returns (
        uint256[4] memory okbAmounts,
        uint256[4] memory grushAmounts,
        bool[4] memory okbClaimeds,
        bool[4] memory grushClaimeds
    ) {
        for (uint8 i = 1; i <= 3; i++) {
            Prediction storage pred = predictions[_matchId][_user][i];
            okbAmounts[i] = pred.okbAmount;
            grushAmounts[i] = pred.grushAmount;
            okbClaimeds[i] = pred.okbClaimed;
            grushClaimeds[i] = pred.grushClaimed;
        }
    }

    // --- Native OKB Deposits and Admin Management ---

    receive() external payable {}

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= totalOkbLiability, "Contract is underfunded");
        require(amount <= address(this).balance - totalOkbLiability, "Amount reserved for jackpots");
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdraw transfer failed");
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

    // --- Configuration ---

    function setGoalRushChance(uint256 _chance) external onlyOwner {
        require(_chance <= 100, "Chance too high");
        goalRushChance = _chance;
    }

    // --- Ownership Transfer ---

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
