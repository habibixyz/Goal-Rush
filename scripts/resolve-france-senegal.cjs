const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";

  console.log(`Using owner account: ${owner.address}`);

  const abi = [
    "function resolveMatch(uint256 _matchId, uint8 _winner) external",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, owner);

  const rawMatchId = "espn_760432";
  const numericId = BigInt(ethers.id(rawMatchId));

  console.log(`Resolving match ID: ${rawMatchId} (Numeric: ${numericId.toString()})`);

  const matchData = await hook.matches(numericId);
  if (matchData.id.toString() === "0") {
    console.error("Error: Match does not exist on-chain!");
    return;
  }

  if (matchData.resolved) {
    console.log(`Match is already resolved on-chain! Winner is Team #${matchData.winner}`);
    return;
  }

  console.log("Submitting resolveMatch transaction (Winner: 1 - France)...");
  const tx = await hook.resolveMatch(numericId, 1); // 1 = Team A (France)
  console.log(`Transaction submitted: ${tx.hash}`);
  console.log("Waiting for block confirmation...");
  await tx.wait();
  console.log("🎉 France vs Senegal match resolved successfully on-chain!");
}

main().catch(console.error);
