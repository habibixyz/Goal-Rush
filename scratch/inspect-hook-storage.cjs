const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  
  const sigs = [
    "function poolKey() external view returns (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)",
    "function poolId() external view returns (bytes32)",
    "function getPoolId() external view returns (bytes32)"
  ];

  for (const sig of sigs) {
    try {
      const contract = await ethers.getContractAt([sig], hookAddress);
      const funcName = sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName]();
      console.log(`✅ ${funcName}():`, res);
    } catch (e) {
      console.log(`❌ ${sig.split(" ")[1]} failed: ${e.message.split("\n")[0]}`);
    }
  }
}

main().catch(console.error);
