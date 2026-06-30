const { ethers } = require("ethers");
require('dotenv').config();

async function main() {
  const p = new ethers.JsonRpcProvider("https://rpc.xlayer.tech");
  
  if (!process.env.PRIVATE_KEY) {
      console.log("No PRIVATE_KEY found in .env");
      return;
  }
  
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, p);
  const agentAddress = wallet.address;
  console.log(`Agent Wallet Address: ${agentAddress}`);

  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  
  const abi = [
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] memory okbAmounts, uint256[4] memory grushAmounts, bool[4] memory okbClaimeds, bool[4] memory grushClaimeds)"
  ];
  const hook = new ethers.Contract(hookAddress, abi, p);

  const activeId = await hook.activeMatchId();
  console.log("Active Match ID:", activeId.toString());

  if (activeId === 0n) {
    console.log("No active match.");
    return;
  }

  const matchData = await hook.matches(activeId);
  console.log(`Active Match: ${matchData.teamA} vs ${matchData.teamB}`);

  const predictions = await hook.getUserPredictions(activeId, agentAddress);
  console.log("Agent Predictions (OKB amounts for indices 0, 1, 2, 3):");
  console.log(`  Index 0 (Draw?): ${ethers.formatEther(predictions[0][0])} OKB`);
  console.log(`  Index 1 (Home - ${matchData.teamA}): ${ethers.formatEther(predictions[0][1])} OKB`);
  console.log(`  Index 2 (Away - ${matchData.teamB}): ${ethers.formatEther(predictions[0][2])} OKB`);
  console.log(`  Index 3: ${ethers.formatEther(predictions[0][3])} OKB`);
}

main().catch(console.error);
