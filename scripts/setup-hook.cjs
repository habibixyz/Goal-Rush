const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0xC907030AeCd8fC81B19678cDD08DCF96cD9380c0";
  const routerAddress = "0x5Ae40D89c38109764B91eE97F41deE4F1E86b26c";
  const grushTokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";

  console.log(`Setting up WorldCupGoalRushHook at: ${hookAddress}`);
  const hook = await ethers.getContractAt("WorldCupGoalRushHook", hookAddress);

  console.log(`Setting Prediction Router to: ${routerAddress}...`);
  let tx = await hook.setPredictionRouter(routerAddress);
  await tx.wait();
  console.log("Prediction Router set successfully!");

  console.log(`Setting GRUSH Token to: ${grushTokenAddress}...`);
  tx = await hook.setGrushToken(grushTokenAddress);
  await tx.wait();
  console.log("GRUSH Token set successfully!");
}

main().catch(console.error);
