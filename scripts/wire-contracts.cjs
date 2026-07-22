const { ethers } = require("hardhat");

const HOOK_ADDRESS = "0x8bD62234113b1A860A09ABc9ECDaC86376E49DA9";
const ROUTER_ADDRESS = "0x66ef1ac1B70C6248422B9E30BdD498736d4a1A2B";
const GRUSH_TOKEN = "0x422fe165b2da990d18c6dca944b11dcd61519671";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Hook:     ${HOOK_ADDRESS}`);
  console.log(`Router:   ${ROUTER_ADDRESS}`);

  const HookFactory = await ethers.getContractFactory("WorldCupGoalRushHook");
  const hook = HookFactory.attach(HOOK_ADDRESS);

  // Check current setting
  const currentRouter = await hook.predictionRouter();
  const currentGrush = await hook.grushToken();
  console.log(`Current Router set on hook: ${currentRouter}`);
  console.log(`Current GRUSH set on hook:  ${currentGrush}`);

  if (currentRouter.toLowerCase() !== ROUTER_ADDRESS.toLowerCase()) {
    console.log("\n🔧 Setting PredictionRouter on Hook...");
    const tx = await hook.setPredictionRouter(ROUTER_ADDRESS);
    console.log(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait(1);
    console.log("✅ PredictionRouter set successfully!");
  } else {
    console.log("PredictionRouter is already set correctly.");
  }

  if (currentGrush.toLowerCase() !== GRUSH_TOKEN.toLowerCase()) {
    console.log("\n🔧 Setting GRUSH Token on Hook...");
    const tx = await hook.setGrushToken(GRUSH_TOKEN);
    console.log(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait(1);
    console.log("✅ GRUSH Token set successfully!");
  } else {
    console.log("GRUSH Token is already set correctly.");
  }

  console.log("\n🎉 Verification query:");
  const verifiedRouter = await hook.predictionRouter();
  const verifiedGrush = await hook.grushToken();
  console.log(`Verified Router: ${verifiedRouter}`);
  console.log(`Verified GRUSH:  ${verifiedGrush}`);
}

main().catch(console.error);
