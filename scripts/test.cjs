// scripts/test.js
const { ethers } = require("hardhat");

async function main() {
  const [owner, swapper1, swapper2] = await ethers.getSigners();
  console.log("Starting GoalRush World Cup Hook simulation test...");

  // 1. Deploy Mock PoolManager
  console.log("\nDeploying Mock PoolManager...");
  const MockPoolManager = await ethers.getContractFactory("MockPoolManager");
  const poolManager = await MockPoolManager.deploy();
  await poolManager.waitForDeployment();
  console.log("MockPoolManager deployed to:", await poolManager.getAddress());

  // 2. Deploy WorldCupGoalRushHook
  console.log("\nDeploying WorldCupGoalRushHook...");
  const GoalRushHook = await ethers.getContractFactory("WorldCupGoalRushHook");
  const hook = await GoalRushHook.deploy(await poolManager.getAddress());
  await hook.waitForDeployment();
  console.log("WorldCupGoalRushHook deployed to:", await hook.getAddress());

  console.log("\nDeploying GRUSH token and prediction router...");
  const GoalRushToken = await ethers.getContractFactory("GoalRushToken");
  const grush = await GoalRushToken.deploy(100000000);
  await grush.waitForDeployment();
  const Router = await ethers.getContractFactory("GoalRushPredictionRouter");
  const router = await Router.deploy(await hook.getAddress(), await grush.getAddress());
  await router.waitForDeployment();
  await hook.setPredictionRouter(await router.getAddress());
  await hook.setGrushToken(await grush.getAddress());
  console.log("Prediction router deployed to:", await router.getAddress());

  // 3. Create a Match: Argentina (1) vs France (2)
  console.log("\nCreating Match #1: Argentina vs France (duration: 2 hours)...");
  const matchId = 1;
  const duration = 2 * 60 * 60; // 2 hours
  await hook.createMatch(matchId, "Argentina", "France", duration);
  console.log("Match #1 successfully created!");

  // 4. Simulate a Swap by Swapper 1 (Predicting Argentina)
  console.log("\nSimulating Swap 1: Swapper 1 swaps 10 ETH, predicts Argentina (Team 1)...");
  const hookData1 = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint8", "address"],
    [1, swapper1.address]
  );
  
  await poolManager.executeMockSwap(
    await hook.getAddress(),
    swapper1.address,
    true,
    ethers.parseEther("10"),
    hookData1
  );
  
  // Verify Jackpot addition
  let matchInfo = await hook.matches(matchId);
  console.log("Jackpot Pool Status:", ethers.formatEther(matchInfo.totalJackpot), "ETH");

  // 5. Simulate a Swap by Swapper 2 (Predicting France)
  console.log("\nSimulating Swap 2: Swapper 2 swaps 5 ETH, predicts France (Team 2)...");
  const hookData2 = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint8", "address"],
    [2, swapper2.address]
  );
  
  await poolManager.executeMockSwap(
    await hook.getAddress(),
    swapper2.address,
    true,
    ethers.parseEther("5"),
    hookData2
  );

  matchInfo = await hook.matches(matchId);
  console.log("Jackpot Pool Status:", ethers.formatEther(matchInfo.totalJackpot), "ETH");

  // 6. Add a token-backed prediction through the router.
  console.log("\nSwapper 1 predicts Argentina with 100 GRUSH through the router...");
  await grush.transfer(swapper1.address, ethers.parseEther("1000"));
  await grush.connect(swapper1).approve(await router.getAddress(), ethers.parseEther("1000"));
  await router.connect(swapper1).predictWithGRUSH(1, ethers.parseEther("100"));

  // 6b. Test restriction of changing predicted team
  console.log("\nTesting changing team prediction restriction...");
  try {
    await router.connect(swapper1).predictWithGRUSH(2, ethers.parseEther("100"));
    console.error("FAIL: Swapper 1 was able to change team prediction!");
    process.exit(1);
  } catch (e) {
    if (e.message.includes("Cannot change predicted team")) {
      console.log("PASS: Changing team prediction reverted as expected with: 'Cannot change predicted team'");
    } else {
      console.error("FAIL: Swapper 1 reverted but with incorrect reason:", e.message);
      process.exit(1);
    }
  }

  // 7. Resolve Match: Argentina wins! (Winner = 1)
  console.log("\nResolving Match #1: Declaring Argentina (1) as Winner...");
  await hook.resolveMatch(matchId, 1);
  
  // Fund the hook contract so it has balance to pay out the jackpot
  console.log("\nFunding Hook contract with 1 ETH for jackpot payouts...");
  await owner.sendTransaction({
    to: await hook.getAddress(),
    value: ethers.parseEther("1.0")
  });
  
  // 8. Claim Winnings for Swapper 1
  console.log("\nClaiming Jackpot share for Swapper 1...");
  const initialBalance = await ethers.provider.getBalance(swapper1.address);
  await hook.connect(swapper1).claimJackpot(matchId);
  console.log("Jackpot share successfully claimed by Swapper 1!");

  console.log("\nClaiming GRUSH Jackpot share for Swapper 1...");
  await hook.connect(swapper1).claimGrushJackpot(matchId);
  console.log("GRUSH jackpot share successfully claimed by Swapper 1!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
