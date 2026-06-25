const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  console.log("Inspecting hook contract:", hookAddress);

  const sigs = [
    "function factory() external view returns (address)",
    "function poolManager() external view returns (address)",
    "function getPoolKey() external view returns (address)",
    "function token() external view returns (address)",
    "function graduated() external view returns (bool)",
    "function getBuyPrice(uint256 amount) external view returns (uint256)",
    "function getSellPrice(uint256 amount) external view returns (uint256)"
  ];

  for (const sig of sigs) {
    try {
      const contract = await ethers.getContractAt([sig], hookAddress);
      const funcName = sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName]();
      console.log(`✅ ${funcName}(): ${res}`);
    } catch (e) {
      console.log(`❌ ${sig.split(" ")[1]} failed: ${e.message.split("\n")[0]}`);
    }
  }
}

main().catch(console.error);
