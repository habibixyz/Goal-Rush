const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://rpc.xlayer.tech";
const TARGET_WALLET = "0x95516932ede17e05d118b67130b2d2e1567c1037";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  
  // Get contract balance in wei
  const contractBalance = await provider.getBalance(HOOK);
  console.log("Hook Contract Balance in Wei:", contractBalance.toString());

  const abi = [
    "function predictions(uint256, address) view returns (uint8 predictedTeam, uint256 okbAmount, uint256 grushAmount, bool okbClaimed, bool grushClaimed)",
    "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function teamPredictionVolume(uint256, uint8) view returns (uint256)"
  ];
  const hook = new ethers.Contract(HOOK, abi, provider);

  const franceSenegalId = BigInt(ethers.id("espn_760432"));
  
  // Get match details in wei
  const matchData = await hook.matches(franceSenegalId);
  console.log("Match totalJackpot in Wei:", matchData.totalJackpot.toString());
  console.log("Match totalPredictionVolume in Wei:", matchData.totalPredictionVolume.toString());

  const pred = await hook.predictions(franceSenegalId, TARGET_WALLET);
  console.log("User prediction okbAmount in Wei:", pred.okbAmount.toString());

  const winnerVolume = await hook.teamPredictionVolume(franceSenegalId, matchData.winner);
  console.log("Winner Volume in Wei:", winnerVolume.toString());

  const claimAmount = (pred.okbAmount * matchData.totalJackpot) / winnerVolume;
  console.log("Calculated claimAmount in Wei:", claimAmount.toString());

  console.log("Difference (Balance - claimAmount):", (contractBalance - claimAmount).toString());
}

main().catch(console.error);
