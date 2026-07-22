// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGoalRushHook {
    function activeMatchId() external view returns (uint256);
    function placeEthPredictionFor(uint256 _matchId, address user, uint8 predictedTeam) external payable;
    function placeGrushPredictionFor(uint256 _matchId, address user, uint8 predictedTeam, uint256 amount) external;
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract GoalRushPredictionRouter {
    address payable public immutable hookAddress;
    IERC20 public immutable grushToken;

    event PredictionDeposited(address indexed user, uint8 indexed team, uint256 amount);
    event GrushPredictionDeposited(address indexed user, uint8 indexed team, uint256 amount);

    constructor(address payable _hookAddress, address _grushToken) {
        hookAddress = _hookAddress;
        grushToken = IERC20(_grushToken);
    }

    function predictWithETH(uint256 _matchId, uint8 predictedTeam) external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");
        
        IGoalRushHook(hookAddress).placeEthPredictionFor{value: msg.value}(_matchId, msg.sender, predictedTeam);
        
        emit PredictionDeposited(msg.sender, predictedTeam, msg.value);
    }

    // Backward-compatible helper for UI deployments.
    function predictWithOKB(uint256 _matchId, uint8 predictedTeam) external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");
        
        IGoalRushHook(hookAddress).placeEthPredictionFor{value: msg.value}(_matchId, msg.sender, predictedTeam);
        
        emit PredictionDeposited(msg.sender, predictedTeam, msg.value);
    }

    function predictWithGRUSH(uint256 _matchId, uint8 predictedTeam, uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(predictedTeam == 1 || predictedTeam == 2 || predictedTeam == 3, "Invalid prediction");

        require(grushToken.transferFrom(msg.sender, hookAddress, amount), "GRUSH transfer failed");
        IGoalRushHook(hookAddress).placeGrushPredictionFor(_matchId, msg.sender, predictedTeam, amount);

        emit GrushPredictionDeposited(msg.sender, predictedTeam, amount);
    }

    function predictAndDeposit() external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        uint256 activeId = IGoalRushHook(hookAddress).activeMatchId();
        IGoalRushHook(hookAddress).placeEthPredictionFor{value: msg.value}(activeId, msg.sender, 1);
        emit PredictionDeposited(msg.sender, 1, msg.value);
    }

    function batchPredictWithETH(
        uint256[] calldata _matchIds,
        uint8[] calldata _predictedTeams,
        uint256[] calldata _amounts
    ) external payable {
        require(_matchIds.length == _predictedTeams.length && _predictedTeams.length == _amounts.length, "Lengths mismatch");
        uint256 totalRequired = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalRequired += _amounts[i];
        }
        require(msg.value >= totalRequired, "Insufficient ETH sent");

        for (uint256 i = 0; i < _matchIds.length; i++) {
            IGoalRushHook(hookAddress).placeEthPredictionFor{value: _amounts[i]}(_matchIds[i], msg.sender, _predictedTeams[i]);
            emit PredictionDeposited(msg.sender, _predictedTeams[i], _amounts[i]);
        }
    }

    receive() external payable {}
}
