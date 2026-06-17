const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOKS = [
  "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0",
  "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0"
];
const RPC = "https://rpc.xlayer.tech";
const TARGET_WALLET = "0x95516932ede17e05d118b67130b2d2e1567c1037";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  console.log("Checking target wallet address:", TARGET_WALLET);

  const abi = [
    "function predictions(uint256, address) view returns (uint8 predictedTeam, uint256 okbAmount, uint256 grushAmount, bool okbClaimed, bool grushClaimed)",
    "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];

  const matchIds = ["espn_760432", "api-france-senegal-live"];

  for (const hookAddr of HOOKS) {
    console.log(`\nChecking Hook at: ${hookAddr}`);
    const hook = new ethers.Contract(hookAddr, abi, provider);

    for (const matchId of matchIds) {
      const numericId = BigInt(ethers.id(matchId));
      try {
        const matchData = await hook.matches(numericId);
        if (matchData[0] !== 0n) {
          console.log(`  Match ${matchId} (Numeric: ${numericId.toString()}):`);
          console.log(`    Exists: true`);
          console.log(`    Resolved: ${matchData[5]}, Winner: ${matchData[6]}`);
          
          const pred = await hook.predictions(numericId, TARGET_WALLET);
          console.log(`    Prediction:`);
          console.log("      Predicted Team:", pred[0].toString(), pred[0] === 1n ? "(France)" : pred[0] === 2n ? "(Senegal)" : "(Draw/None)");
          console.log("      OKB Amount:", ethers.formatEther(pred[1]), "OKB");
          console.log("      GRUSH Amount:", ethers.formatEther(pred[2]), "GRUSH");
          console.log("      OKB Claimed:", pred[3]);
          console.log("      GRUSH Claimed:", pred[4]);
        }
      } catch (e) {
        console.log(`    Error checking match ${matchId}: ${e.message}`);
      }
    }
  }
}

main().catch(console.error);
