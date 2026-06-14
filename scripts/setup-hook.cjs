const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0";
  const routerAddress = "0xB8332a105f2ea7F53Bd94554F74658Bf767f8D67";
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
