const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://rpc.xlayer.tech";
const TARGET_WALLET = "0x95516932ede17e05d118b67130b2d2e1567c1037";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = [
    "function predictions(uint256, address) view returns (uint8 predictedTeam, uint256 okbAmount, uint256 grushAmount, bool okbClaimed, bool grushClaimed)",
    "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function teamPredictionVolume(uint256, uint8) view returns (uint256)"
  ];
  const hook = new ethers.Contract(HOOK, abi, provider);

  const rawIds = ["1", "demo_1", "espn_760432", "api-france-senegal-live"];

  for (const rawId of rawIds) {
    let numericId;
    if (isNaN(rawId)) {
      numericId = BigInt(ethers.id(rawId));
    } else {
      numericId = BigInt(rawId);
    }

    try {
      const matchData = await hook.matches(numericId);
      if (matchData.id !== 0n) {
        console.log(`\nMatch rawId: ${rawId} (Numeric: ${numericId.toString()})`);
        console.log(`  Teams: ${matchData.teamA} vs ${matchData.teamB}`);
        console.log(`  Resolved: ${matchData.resolved}, Winner: ${matchData.winner}`);
        console.log(`  Total Jackpot: ${ethers.formatEther(matchData.totalJackpot)} OKB`);
        
        const pred = await hook.predictions(numericId, TARGET_WALLET);
        if (pred.okbAmount > 0n || pred.grushAmount > 0n) {
          console.log(`  Target Wallet Prediction:`);
          console.log(`    Predicted Team: ${pred.predictedTeam}`);
          console.log(`    OKB Amount: ${ethers.formatEther(pred.okbAmount)} OKB (Claimed: ${pred.okbClaimed})`);
          console.log(`    GRUSH Amount: ${ethers.formatEther(pred.grushAmount)} GRUSH (Claimed: ${pred.grushClaimed})`);
        } else {
          console.log(`  Target Wallet has no prediction on this match.`);
        }
      }
    } catch (e) {
      console.log(`Error checking rawId ${rawId}: ${e.message}`);
    }
  }
}

main().catch(console.error);
