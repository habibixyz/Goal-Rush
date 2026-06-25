const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  
  // Try querying common pump.fun / eulr.fun getters
  const getters = [
    "function factory() external view returns (address)",
    "function hook() external view returns (address)",
    "function pool() external view returns (address)",
    "function poolId() external view returns (bytes32)",
    "function curve() external view returns (address)",
    "function getPoolKey() external view returns (address)",
    "function getHookAddress() external view returns (address)"
  ];

  for (const sig of getters) {
    try {
      const contract = await ethers.getContractAt([sig], tokenAddress);
      const funcName = sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName]();
      console.log(`✅ ${funcName}(): ${res}`);
    } catch (e) {
      console.log(`❌ ${sig.split(" ")[1]} failed`);
    }
  }
}

main().catch(console.error);
