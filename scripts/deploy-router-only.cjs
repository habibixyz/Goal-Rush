const { ethers } = require("hardhat");

const HOOK_ADDRESS = "0x700656337a252A004Ca0B170828f4adEaa680288";
const GRUSH_TOKEN = "0x422fe165b2da990d18c6dca944b11dcd61519671";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Using Hook address: ${HOOK_ADDRESS}`);

  // 1. Deploy Router
  console.log("\n📦 Deploying GoalRushPredictionRouter...");
  const RouterFactory = await ethers.getContractFactory("GoalRushPredictionRouter");
  const router = await RouterFactory.deploy(HOOK_ADDRESS, GRUSH_TOKEN);
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log(`✅ Router deployed to: ${ROUTER_ADDRESS}`);

  // 2. Wire Hook and Router
  const HookFactory = await ethers.getContractFactory("WorldCupGoalRushHook");
  const hook = HookFactory.attach(HOOK_ADDRESS);

  console.log("\n🔧 Setting PredictionRouter on Hook...");
  let tx = await hook.setPredictionRouter(ROUTER_ADDRESS);
  console.log(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
  await tx.wait(1);
  console.log("✅ PredictionRouter set");

  console.log("\n🔧 Setting GRUSH Token on Hook...");
  tx = await hook.setGrushToken(GRUSH_TOKEN);
  console.log(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
  await tx.wait(1);
  console.log("✅ GRUSH Token set");

  console.log("\n🎉 Setup complete!");
  console.log(`HOOK_ADDRESS   = '${HOOK_ADDRESS}'`);
  console.log(`ROUTER_ADDRESS = '${ROUTER_ADDRESS}'`);
}

main().catch(console.error);
