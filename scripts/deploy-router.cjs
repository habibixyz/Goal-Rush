const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";
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
