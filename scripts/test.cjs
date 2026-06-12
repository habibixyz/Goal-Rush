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

  // 6. Resolve Match: Argentina wins! (Winner = 1)
  console.log("\nResolving Match #1: Declaring Argentina (1) as Winner...");
  await hook.resolveMatch(matchId, 1);
  
  // Fund the hook contract so it has balance to pay out the jackpot
  console.log("\nFunding Hook contract with 1 ETH for jackpot payouts...");
  await owner.sendTransaction({
    to: await hook.getAddress(),
    value: ethers.parseEther("1.0")
  });
  
  // 7. Claim Winnings for Swapper 1
  console.log("\nClaiming Jackpot share for Swapper 1...");
  const initialBalance = await ethers.provider.getBalance(swapper1.address);
  await hook.connect(swapper1).claimJackpot(matchId);
  console.log("Jackpot share successfully claimed by Swapper 1!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
