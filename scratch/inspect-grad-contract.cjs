const { ethers } = require("hardhat");

async function main() {
  const address = "0xa0b4EC3D6e3dac466572ef85582FC6233aA13a03";

  console.log(`Querying contract ${address} view functions...`);

  const signatures = [
    "function owner() external view returns (address)",
    "function factory() external view returns (address)",
    "function poolManager() external view returns (address)",
    "function manager() external view returns (address)",
    "function token() external view returns (address)",
    "function getHook(address token) external view returns (address)",
    "function getPool(address token) external view returns (address)"
  ];

  for (const sig of signatures) {
    try {
      const contract = await ethers.getContractAt([sig], address);
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
