const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
  const routerAddress = "0xB7c9d225f7Ad8669fF31cc39D771b3365631110D";
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
