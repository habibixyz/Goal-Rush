const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0";
  const grushTokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  console.log("Deploying GoalRushPredictionRouter with Hook address:", hookAddress);
  console.log("Using GRUSH token address:", grushTokenAddress);

  const Router = await ethers.getContractFactory("GoalRushPredictionRouter");
  const router = await Router.deploy(hookAddress, grushTokenAddress);

  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("GoalRushPredictionRouter deployed to:", routerAddress);
  console.log("Run setPredictionRouter on the hook with this router address before accepting deposits.");
}

main().catch(console.error);
