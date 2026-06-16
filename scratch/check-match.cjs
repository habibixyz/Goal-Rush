const { ethers } = require("ethers");

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://rpc.xlayer.tech";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = [
    "function activeMatchId() view returns (uint256)",
    "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function predictions(uint256, address) view returns (uint8 predictedTeam, uint256 okbAmount, uint256 grushAmount, bool okbClaimed, bool grushClaimed)",
    "function teamPredictionVolume(uint256, uint8) view returns (uint256)"
  ];
  const hook = new ethers.Contract(HOOK, abi, provider);

  // Check the current active match
  const activeId = await hook.activeMatchId();
  console.log("Active Match ID:", activeId.toString());

  // France vs Senegal was registered as "espn_760432"
  const franceSenegalId = BigInt(ethers.id("espn_760432"));
  console.log("\nFrance vs Senegal numeric ID:", franceSenegalId.toString());

  try {
    const match = await hook.matches(franceSenegalId);
    console.log("\nMatch data:");
    console.log("  ID:", match[0].toString());
    console.log("  Team A:", match[1]);
    console.log("  Team B:", match[2]);
    console.log("  Resolved:", match[5]);
    console.log("  Winner:", match[6].toString(), match[6] === 0n ? "(None/Draw)" : match[6] === 1n ? "(Team A)" : match[6] === 2n ? "(Team B)" : `(${match[6]})`);
    console.log("  Total Jackpot:", ethers.formatEther(match[7]), "OKB");
    console.log("  Total Volume:", ethers.formatEther(match[8]), "OKB");
  } catch (e) {
    console.log("Error reading France vs Senegal match:", e.message);
  }

  // Also check what matches exist by looking at the active ID
  try {
    const activeMatch = await hook.matches(activeId);
    console.log("\nActive match data:");
    console.log("  ID:", activeMatch[0].toString());
    console.log("  Team A:", activeMatch[1]);
    console.log("  Team B:", activeMatch[2]);
    console.log("  Resolved:", activeMatch[5]);
    console.log("  Winner:", activeMatch[6].toString());
  } catch (e) {
    console.log("Error reading active match:", e.message);
  }

  // Check some known match IDs
  const knownIds = [1, 2, 3, 10];
  for (const id of knownIds) {
    try {
      const m = await hook.matches(id);
      if (m[0] > 0n) {
        console.log(`\nMatch #${id}: ${m[1]} vs ${m[2]} | resolved=${m[5]} | winner=${m[6]}`);
      }
    } catch (_) {}
  }
}

main().catch(console.error);
