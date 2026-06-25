const { ethers } = require("hardhat");

function espnIdToOnChain(espnId) {
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(`espn_${espnId}`)));
}

async function main() {
  const hookAddress = "0xf568f5343116D369a7C7a50E69C7F89B79A65E37";
  const hook = await ethers.getContractAt([
    "function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ], hookAddress);

  const espnId = "760442"; // Australia vs United States
  const onChainId = espnIdToOnChain(espnId);
  console.log(`On-chain ID for Australia vs United States: ${onChainId.toString()}`);

  // Check if already created on-chain
  const matchData = await hook.matches(onChainId);
  if (matchData.id !== 0n) {
    console.log("Match already exists on-chain. Skipping manual activation.");
    return;
  }

  // Activate with a 24 hour duration (86400 seconds)
  const duration = 24 * 60 * 60;
  console.log(`Activating match on-chain with duration: ${duration} seconds...`);
  const [deployer] = await ethers.getSigners();
  console.log(`Using wallet: ${deployer.address}`);

  const tx = await hook.createMatch(onChainId, "United States", "Australia", duration);
  console.log(`Submitted TX: ${tx.hash}`);
  await tx.wait(1);
  console.log("✅ Match successfully activated on-chain!");
}

main().catch(console.error);
