// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {WorldCupGoalRushHook, IPoolManager, PoolKey, BeforeSwapDelta} from "../WorldCupGoalRushHook.sol";

contract MockPoolManager {
    // Basic implementation of PoolManager mock for local developer testing
    event SwapTriggered(
        address indexed hook,
        address indexed sender,
        bool zeroForOne,
        int256 amountSpecified,
        bytes hookData
    );

    function executeMockSwap(
        address hookAddress,
        address swapper,
        bool zeroForOne,
        int256 amountSpecified,
        bytes calldata hookData
    ) external returns (bytes4, bytes4) {
        WorldCupGoalRushHook hook = WorldCupGoalRushHook(payable(hookAddress));
        
        PoolKey memory key = PoolKey({
            currency0: address(0),
            currency1: address(0),
            fee: 3000,
            tickSpacing: 60,
            hooks: hookAddress
        });

        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: 0
        });

        // Trigger beforeSwap
        (bytes4 beforeSelector, , ) = hook.beforeSwap(
            swapper,
            key,
            params,
            hookData
        );

        // Trigger afterSwap
        (bytes4 afterSelector, ) = hook.afterSwap(
            swapper,
            key,
            params,
            0,
            0,
            hookData
        );

        emit SwapTriggered(hookAddress, swapper, zeroForOne, amountSpecified, hookData);

        return (beforeSelector, afterSelector);
    }
}
