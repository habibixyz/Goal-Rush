const { ethers } = require("hardhat");

const candidateSignatures = [
  // Uniswap V4 PoolManager events
  "Initialize(bytes32,address,address,uint24,int24,address)",
  "ModifyLiquidity(bytes32,address,int24,int24,int256,bytes32)",
  "Swap(bytes32,address,int128,int128,uint160,uint128,int24,bytes32)",
  "Donate(bytes32,address,uint256,uint256,bytes32)",
  
  // Custom Eulr / graduation events
  "Graduated(address,address,uint256)",
  "TokenGraduated(address,address,uint256)",
  "Graduation(address,address,uint256,uint256)",
  "CurveGraduated(address,uint256)",
  "CurveGraduation(address,address,uint256)",
  "TokenGraduation(address,address,uint256)",
  "Graduate(address,address,uint256)",
  "GraduationCompleted(address,address,uint256)",
  "PoolInitialized(address,address,uint24,int24,address)",
  "PoolCreated(address,address,uint24,int24,address)",
  
  // ERC20/ERC721 events
  "Transfer(address,address,uint256)",
  "Approval(address,address,uint256)",
  
  // Other potential hook/factory events
  "Deposit(address,address,uint256,uint256)",
  "Withdraw(address,address,uint256,uint256)",
  "Mint(address,uint256,uint256)",
  "Burn(address,uint256,uint256)",
  "Collect(address,address,int24,int24,uint128,uint128)",
  "Flash(address,address,uint256,uint256,uint256,uint256)",
  "SetFee(uint24,uint24)",
  
  // Maybe events with address, address, uint256
  "Graduated(address,address,address)",
  "Graduation(address,address,address)",
  "TokenGraduated(address,address,address)",
  "Graduation(address,address,bytes32)",
  "Graduation(address,address,address,uint256)"
];

async function main() {
  const targets = [
    "a8c0e936fa46771ad64aba8f899979197e4382661de3e12f21336d390598d246",
    "d54183f60e2a8a7677138e1740a2037fa34cd8d29b7b35a66189e2953a63a14f"
  ];

  for (const sig of candidateSignatures) {
    const hash = ethers.id(sig);
    const hashHex = hash.slice(2);
    for (const target of targets) {
      if (hashHex === target) {
        console.log(`🎉 MATCH FOUND for target ${target}!`);
        console.log(`  Signature: ${sig}`);
      }
    }
  }
}

main().catch(console.error);
