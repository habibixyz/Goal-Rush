const { ethers } = require("ethers");
require('dotenv').config();

async function main() {
  const p = new ethers.JsonRpcProvider("https://xlayer-mainnet.rpc.sentio.xyz");
  
  if (!process.env.PRIVATE_KEY) {
      console.log("No PRIVATE_KEY found in .env");
      return;
  }
  
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, p);
  const agentAddress = wallet.address;
  console.log(`Agent Wallet Address: ${agentAddress}`);

  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288"; // From goalrush-ai-agent.cjs
  
  const abi = [
    "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] memory okbAmounts, uint256[4] memory grushAmounts, bool[4] memory okbClaimeds, bool[4] memory grushClaimeds)"
  ];
  const hook = new ethers.Contract(hookAddress, abi, p);

  console.log(`Scanning all OKB predictions for Agent on Hook: ${hookAddress}`);
  
  // Create a filter specifically for the agent's address
  const filter = hook.filters.PredictionPlaced(agentAddress);
  const logs = await hook.queryFilter(filter, 0, "latest");
  
  console.log(`Found ${logs.length} predictions made by the AGI Agent:`);
  
  let totalWon = 0n;
  let totalClaimed = 0n;

  for (const log of logs) {
    const matchId = log.args.matchId;
    const predictedTeam = log.args.team;
    const volume = log.args.volume;
    
    console.log(`\n- Match ID: ${matchId.toString()} | Predicted Team: ${predictedTeam} | Bet Amount: ${ethers.formatEther(volume)} OKB`);
    
    const matchDetails = await hook.matches(matchId);
    console.log(`  Match: ${matchDetails.teamA} vs ${matchDetails.teamB} | Resolved: ${matchDetails.resolved}`);
    
    if (matchDetails.resolved) {
      const winner = matchDetails.winner;
      console.log(`  Winner: Team ${winner} (${winner === 1n ? matchDetails.teamA : (winner === 2n ? matchDetails.teamB : 'Draw')})`);
      
      const predictions = await hook.getUserPredictions(matchId, agentAddress);
      const okbClaimeds = predictions[2];
      
      if (winner === BigInt(predictedTeam)) {
         console.log(`  🎉 AI WON this match!`);
         // Winnings depend on total jackpot and volume, this requires complex calculation, 
         // but we can check if it claimed.
         if (okbClaimeds[winner]) {
             console.log(`  ✅ Winnings have been CLAIMED.`);
             totalClaimed++;
         } else {
             console.log(`  ❌ Winnings have NOT been claimed yet.`);
         }
         totalWon++;
      } else {
         console.log(`  💀 AI LOST this match.`);
      }
    } else {
       console.log(`  ⏳ Match is still pending/unresolved.`);
    }
  }
  
  console.log(`\nSummary: Made ${logs.length} predictions. Won: ${totalWon}. Claimed: ${totalClaimed}.`);
}

main().catch(console.error);
