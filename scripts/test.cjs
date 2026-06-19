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
  
  // Swap hookData is informational and must not create an unfunded claim.
  let matchInfo = await hook.matches(matchId);
  if (matchInfo.totalJackpot !== 0n) {
    throw new Error("Unfunded swap volume changed the OKB jackpot");
  }

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
  if (matchInfo.totalJackpot !== 0n) {
    throw new Error("Unfunded swap volume changed the OKB jackpot");
  }

  console.log("\nFunding predictions through the router...");
  await router.connect(swapper1).predictWithOKB(1, 1, { value: ethers.parseEther("0.01") });
  await router.connect(swapper2).predictWithOKB(1, 2, { value: ethers.parseEther("0.005") });

  try {
    await hook.withdraw(1n);
    throw new Error("Owner withdrew funds reserved for open jackpot claims");
  } catch (error) {
    if (!error.message.includes("Amount reserved for jackpots")) throw error;
    console.log("PASS: Owner cannot withdraw reserved jackpot funds");
  }

  // 6. Add a token-backed prediction through the router.
  console.log("\nSwapper 1 predicts Argentina with 100 GRUSH through the router...");
  await grush.transfer(swapper1.address, ethers.parseEther("1000"));
  await grush.connect(swapper1).approve(await router.getAddress(), ethers.parseEther("1000"));
  await router.connect(swapper1).predictWithGRUSH(1, 1, ethers.parseEther("100"));

  // 6b. Test predicting multiple different outcomes
  console.log("\nTesting predicting multiple different outcomes...");
  // Predict France (2) with 50 GRUSH for Swapper 1 (who already predicted Team 1)
  await router.connect(swapper1).predictWithGRUSH(1, 2, ethers.parseEther("50"));
  
  // Verify both predictions exist
  const [okbAmounts, grushAmounts, okbClaimeds, grushClaimeds] = await hook.getUserPredictions(1, swapper1.address);
  console.log(`Swapper 1 predictions check:`);
  console.log(`  Team 1 OKB: ${ethers.formatEther(okbAmounts[1])} OKB`);
  console.log(`  Team 1 GRUSH: ${ethers.formatEther(grushAmounts[1])} GRUSH`);
  console.log(`  Team 2 GRUSH: ${ethers.formatEther(grushAmounts[2])} GRUSH`);
  
  if (grushAmounts[1] === ethers.parseEther("100") && grushAmounts[2] === ethers.parseEther("50")) {
    console.log("PASS: Multi-outcome predictions registered successfully!");
  } else {
    console.error("FAIL: Multi-outcome predictions did not register correctly");
    process.exit(1);
  }

  // 7. Resolve Match: Argentina wins! (Winner = 1)
  console.log("\nResolving Match #1: Declaring Argentina (1) as Winner...");
  await hook.resolveMatch(matchId, 1);
  
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
