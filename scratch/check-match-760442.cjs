const { ethers } = require("hardhat");

function espnIdToOnChain(espnId) {
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(`espn_${espnId}`)));
}

async function main() {
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  const hook = await ethers.getContractAt([
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ], hookAddress);

  const espnId = "760442"; // United States vs Australia
  const onChainId = espnIdToOnChain(espnId);
  console.log(`On-chain ID for United States vs Australia: ${onChainId.toString()}`);

  try {
    const matchData = await hook.matches(onChainId);
    console.log("Match Details on-chain:");
    console.log("  - Exists:", matchData.id !== 0n);
    console.log("  - Team A:", matchData.teamA);
    console.log("  - Team B:", matchData.teamB);
    console.log("  - Start Time:", new Date(Number(matchData.startTime) * 1000).toISOString());
    console.log("  - End Time:", new Date(Number(matchData.endTime) * 1000).toISOString());
    console.log("  - Resolved:", matchData.resolved);
  } catch (err) {
    console.error("Error:", err);
  }
}

main().catch(console.error);
