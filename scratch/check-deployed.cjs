const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  const abi = [
    "function predictionRouter() view returns (address)",
    "function grushToken() view returns (address)"
  ];
  const hook = new ethers.Contract(hookAddress, abi, ethers.provider);
  try {
    const router = await hook.predictionRouter();
    const grush = await hook.grushToken();
    console.log(`Hook PredictionRouter set to: ${router}`);
    console.log(`Hook GRUSH Token set to: ${grush}`);
  } catch (err) {
    console.error(`Failed to query Hook: ${err.message}`);
  }
}

main().catch(console.error);
