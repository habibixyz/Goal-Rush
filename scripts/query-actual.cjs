const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0xC907030AeCd8fC81B19678cDD08DCF96cD9380c0";
  
  const abi = [
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, owner);

  const activeId = await hook.activeMatchId();
  console.log("On-Chain Active Match ID:", activeId.toString());

  const ids = ["api-france-senegal-live", "espn_760432"];
  for (const rawMatchId of ids) {
    const numericId = BigInt(ethers.id(rawMatchId));
    console.log(`\nQuerying rawId: ${rawMatchId} (hashed: ${numericId.toString()})`);
    try {
      const matchData = await hook.matches(numericId);
      console.log("Match Data returned:", {
        id: matchData.id.toString(),
        teamA: matchData.teamA,
        teamB: matchData.teamB,
        resolved: matchData.resolved
      });
    } catch (err) {
      console.error("Error querying match:", err);
    }
  }
}

main().catch(console.error);
