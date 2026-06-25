const { ethers } = require("hardhat");

async function main() {
  const factoryAddress = "0xBf2334d853D1239B093934c2BCB7a78869d1F287";
  
  const signatures = [
    "function owner() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function tickSpacing() external view returns (int24)",
    "function feeCollector() external view returns (address)",
    "function getHook(address token) external view returns (address)",
    "function getToken(address deployer) external view returns (address)",
    "function getPool(address token) external view returns (address)",
    "function parameters() external view returns (address)"
  ];

  for (const sig of signatures) {
    try {
      const contract = await ethers.getContractAt([sig], factoryAddress);
      const funcName = sig.split(" ")[1].split("(")[0];
      const paramStr = sig.split("(")[1].split(")")[0];
      const hasArgs = paramStr.trim().length > 0;
      
      const res = hasArgs 
        ? await contract[funcName]("0x422fe165b2da990d18c6dca944b11dcd61519671")
        : await contract[funcName]();
      console.log(`✅ ${sig}: ${JSON.stringify(res)}`);
    } catch (e) {
      console.log(`❌ ${sig} failed: ${e.message}`);
    }
  }
}

main().catch(console.error);
