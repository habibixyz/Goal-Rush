// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Create2Deployer {
    event Deployed(address indexed addr, bytes32 indexed salt);

    function deploy(bytes memory bytecode, bytes32 salt) external returns (address) {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        emit Deployed(addr, salt);
        return addr;
    }
}
