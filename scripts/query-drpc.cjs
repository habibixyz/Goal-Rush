const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const hookAddress = "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0";
  
  const abi = [
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function teamPredictionVolume(uint256, uint8) external view returns (uint256)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, rpcProvider);

  try {
    const activeId = await hook.activeMatchId();
    console.log("Active Match ID:", activeId.toString());

    const matchData = await hook.matches(10);
    console.log("Match #10 Data:", {
      id: matchData.id.toString(),
      teamA: matchData.teamA,
      teamB: matchData.teamB,
      totalJackpot: ethers.formatEther(matchData.totalJackpot),
      totalPredictionVolume: ethers.formatEther(matchData.totalPredictionVolume)
    });
  } catch (err) {
    console.error("Error querying contract:", err);
  }
}

main().catch(console.error);
