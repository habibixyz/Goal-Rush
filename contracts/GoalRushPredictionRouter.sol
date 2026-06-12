// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract GoalRushPredictionRouter {
    address payable public immutable hookAddress;

    event PredictionDeposited(address indexed user, uint256 amount);

    constructor(address payable _hookAddress) {
        hookAddress = _hookAddress;
    }

    // Explicit payable function to submit a prediction
    function predictAndDeposit() external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        
        // Forward the native OKB to the hook contract
        (bool success, ) = hookAddress.call{value: msg.value}("");
        require(success, "Forwarding to hook contract failed");
        
        emit PredictionDeposited(msg.sender, msg.value);
    }

    // Fallback receive to accept any leftover native tokens
    receive() external payable {
        (bool success, ) = hookAddress.call{value: msg.value}("");
        require(success, "Forwarding failed");
    }
}
