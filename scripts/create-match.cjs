const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";

  console.log(`Using owner account: ${owner.address}`);
  
  // Minimal ABI for createMatch and activeMatchId
  const abi = [
    "function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external",
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, owner);

  console.log("Checking active match ID...");
  const activeId = await hook.activeMatchId();
  console.log(`Active Match ID on contract: ${activeId}`);

  if (activeId.toString() === "0") {
    console.log("Creating Match #1: Argentina vs France (duration 30 days)...");
    const tx = await hook.createMatch(1, "Argentina", "France", 30 * 24 * 60 * 60);
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log("Match #1 successfully created on-chain!");
  } else {
    const matchData = await hook.matches(activeId);
    console.log(`Match #${activeId} already active: ${matchData.teamA} vs ${matchData.teamB}`);
  }
}

main().catch(console.error);
