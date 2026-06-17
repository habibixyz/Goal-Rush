const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://rpc.xlayer.tech";
const TARGET_WALLET = "0x95516932ede17e05d118b67130b2d2e1567c1037";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  
  // Get contract balance
  const contractBalance = await provider.getBalance(HOOK);
  console.log("Hook Contract Balance:", ethers.formatEther(contractBalance), "OKB");

  const abi = [
    "function claimJackpot(uint256 _matchId) external",
    "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];
  const hook = new ethers.Contract(HOOK, abi, provider);

  const franceSenegalId = BigInt(ethers.id("espn_760432"));
  
  // Get match details
  const matchData = await hook.matches(franceSenegalId);
  console.log("Match Total Jackpot:", ethers.formatEther(matchData.totalJackpot), "OKB");

  // Prepare call simulation
  const iface = new ethers.Interface(abi);
  const txData = iface.encodeFunctionData("claimJackpot", [franceSenegalId]);

  console.log(`Simulating claimJackpot call from ${TARGET_WALLET}...`);
  try {
    const result = await provider.call({
      to: HOOK,
      from: TARGET_WALLET,
      data: txData
    });
    console.log("Simulation succeeded! Return data:", result);
  } catch (err) {
    console.log("Simulation failed!");
    console.log("Error details:", err);
    if (err.data) {
      console.log("Error data:", err.data);
    }
  }
}

main().catch(console.error);
