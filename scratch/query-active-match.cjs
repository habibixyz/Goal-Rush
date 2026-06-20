const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  const hook = await ethers.getContractAt([
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ], hookAddress);

  const activeId = await hook.activeMatchId();
  console.log("Active Match ID:", activeId.toString());

  if (activeId === 0n) {
    console.log("No active match.");
    return;
  }

  const matchData = await hook.matches(activeId);
  const currentBlock = await ethers.provider.getBlock("latest");
  const blockTime = currentBlock.timestamp;

  console.log("Match Details:");
  console.log("  - ID:", matchData.id.toString());
  console.log("  - Team A:", matchData.teamA);
  console.log("  - Team B:", matchData.teamB);
  console.log("  - Start Time:", new Date(Number(matchData.startTime) * 1000).toISOString(), `(${matchData.startTime})`);
  console.log("  - End Time:", new Date(Number(matchData.endTime) * 1000).toISOString(), `(${matchData.endTime})`);
  console.log("  - Resolved:", matchData.resolved);
  console.log("  - Winner:", matchData.winner);
  console.log("  - Total Jackpot:", ethers.formatEther(matchData.totalJackpot), "OKB");
  console.log("  - Total Volume:", ethers.formatEther(matchData.totalPredictionVolume), "OKB");
  console.log("Current Block Timestamp:", new Date(blockTime * 1000).toISOString(), `(${blockTime})`);
  console.log("Is block.timestamp < endTime?", blockTime < Number(matchData.endTime));
}

main().catch(console.error);
