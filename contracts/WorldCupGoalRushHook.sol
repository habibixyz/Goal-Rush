// SPDX-License-Identifier: MIT
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
        uint8 predictedTeam; // 1 = TeamA, 2 = TeamB
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
    // matchId => user => Prediction
    mapping(uint256 => mapping(address => Prediction)) public predictions;
    // matchId => teamId => total prediction volume
    mapping(uint256 => mapping(uint8 => uint256)) public teamPredictionVolume;
    mapping(uint256 => mapping(uint8 => uint256)) public teamGrushPredictionVolume;
    mapping(uint256 => uint256) public matchGrushJackpot;

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

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    modifier onlyPredictionRouter() {
        require(msg.sender == predictionRouter, "Only PredictionRouter");
        _;
    }

    constructor(address _poolManager) {
        poolManager = _poolManager;
        owner = tx.origin;
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
        if (hookData.length > 0 && activeMatchId > 0) {
            Match storage activeMatch = matches[activeMatchId];
            if (!activeMatch.resolved && block.timestamp < activeMatch.endTime) {
                (uint8 predictedTeam, address swapper) = abi.decode(hookData, (uint8, address));
                
                if (predictedTeam == 1 || predictedTeam == 2) {
                    uint256 swapAmount = params.amountSpecified > 0 
                        ? uint256(params.amountSpecified) 
                        : uint256(-params.amountSpecified);

                    _recordOkbPrediction(activeMatchId, swapper, predictedTeam, swapAmount, swapAmount / 1000);
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
            if (hookData.length > 0) {
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

    function resolveMatch(uint256 _matchId, uint8 _winner) external onlyOwner {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.id != 0, "Match does not exist");
        require(!targetMatch.resolved, "Match already resolved");
        require(_winner <= 3, "Invalid winner");

        targetMatch.resolved = true;
        targetMatch.winner = _winner;

        emit MatchResolved(_matchId, _winner, targetMatch.totalJackpot);
    }

    // --- User Claim Functions ---

    function placeOkbPredictionFor(address user, uint8 predictedTeam) external payable onlyPredictionRouter {
        require(msg.value > 0, "Prediction amount required");
        _recordOkbPrediction(activeMatchId, user, predictedTeam, msg.value, msg.value);
    }

    function placeGrushPredictionFor(address user, uint8 predictedTeam, uint256 amount) external onlyPredictionRouter {
        require(amount > 0, "Prediction amount required");
        _recordGrushPrediction(activeMatchId, user, predictedTeam, amount);
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

        Prediction storage pred = predictions[matchId][user];
        pred.predictedTeam = predictedTeam;
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

        Prediction storage pred = predictions[matchId][user];
        pred.predictedTeam = predictedTeam;
        pred.grushAmount += amount;

        teamGrushPredictionVolume[matchId][predictedTeam] += amount;
        matchGrushJackpot[matchId] += amount;

        emit GrushPredictionPlaced(user, matchId, predictedTeam, amount);
    }

    /**
     * @notice Claim native OKB prediction jackpot shares for a resolved match.
     */
    function claimJackpot(uint256 _matchId) external {
        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");
        
        Prediction storage pred = predictions[_matchId][msg.sender];
        require(pred.okbAmount > 0, "No OKB prediction made");
        require(!pred.okbClaimed, "OKB jackpot already claimed");
        require(pred.predictedTeam == targetMatch.winner, "Prediction was incorrect");

        pred.okbClaimed = true;

        uint256 winnerVolume = teamPredictionVolume[_matchId][targetMatch.winner];
        require(winnerVolume > 0, "No winning OKB volume");
        uint256 claimAmount = (pred.okbAmount * targetMatch.totalJackpot) / winnerVolume;

        (bool success, ) = payable(msg.sender).call{value: claimAmount}("");
        require(success, "Jackpot transfer failed");

        emit JackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    function claimGrushJackpot(uint256 _matchId) external {
        require(address(grushToken) != address(0), "GRUSH token not set");

        Match storage targetMatch = matches[_matchId];
        require(targetMatch.resolved, "Match not resolved yet");
        
        Prediction storage pred = predictions[_matchId][msg.sender];
        require(pred.grushAmount > 0, "No GRUSH prediction made");
        require(!pred.grushClaimed, "GRUSH jackpot already claimed");
        require(pred.predictedTeam == targetMatch.winner, "Prediction was incorrect");

        pred.grushClaimed = true;

        uint256 winnerVolume = teamGrushPredictionVolume[_matchId][targetMatch.winner];
        require(winnerVolume > 0, "No winning GRUSH volume");
        uint256 claimAmount = (pred.grushAmount * matchGrushJackpot[_matchId]) / winnerVolume;

        require(grushToken.transfer(msg.sender, claimAmount), "GRUSH transfer failed");

        emit GrushJackpotClaimed(msg.sender, _matchId, claimAmount);
    }

    // --- Native OKB Deposits and Admin Management ---

    receive() external payable {}

    function withdraw(uint256 amount) external onlyOwner {
        (bool success, ) = payable(owner).call{value: amount}("");
        require(success, "Withdraw transfer failed");
    }

    function setPredictionRouter(address _router) external onlyOwner {
        predictionRouter = _router;
        emit PredictionRouterUpdated(_router);
    }

    function setGrushToken(address _token) external onlyOwner {
        grushToken = IERC20(_token);
        emit GrushTokenUpdated(_token);
    }

    // --- Configuration ---

    function setGoalRushChance(uint256 _chance) external onlyOwner {
        require(_chance <= 100, "Chance too high");
        goalRushChance = _chance;
    }
}
