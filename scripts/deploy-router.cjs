const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";
  console.log("Deploying GoalRushPredictionRouter with Hook address:", hookAddress);

  const Router = await ethers.getContractFactory("GoalRushPredictionRouter");
  const router = await Router.deploy(hookAddress);

  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("GoalRushPredictionRouter deployed to:", routerAddress);
}

main().catch(console.error);
