const { ethers } = require("ethers");

const HOOK = "0xC907030AeCd8fC81B19678cDD08DCF96cD9380c0";
const RPC = "https://rpc.xlayer.tech";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = [
    "function activeMatchId() view returns (uint256)",
    "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];
  const hook = new ethers.Contract(HOOK, abi, provider);

  const activeId = await hook.activeMatchId();
  console.log("Active Match ID:", activeId.toString());

  if (activeId > 0n) {
    const matchData = await hook.matches(activeId);
    console.log("Active Match Details:", {
      id: matchData[0].toString(),
      teamA: matchData[1],
      teamB: matchData[2],
      startTime: matchData[3].toString(),
      endTime: matchData[4].toString(),
      resolved: matchData[5],
      winner: matchData[6].toString(),
      totalJackpot: ethers.formatEther(matchData[7]),
      totalPredictionVolume: ethers.formatEther(matchData[8])
    });
  }

  // Also query match details for France vs Senegal (espn_760432)
  const franceSenegalId = BigInt(ethers.id("espn_760432"));
  console.log("\nFrance vs Senegal numeric ID:", franceSenegalId.toString());
  try {
    const matchData = await hook.matches(franceSenegalId);
    console.log("France vs Senegal Details:", {
      id: matchData[0].toString(),
      teamA: matchData[1],
      teamB: matchData[2],
      resolved: matchData[5],
      winner: matchData[6].toString()
    });
  } catch (e) {
    console.log("Error querying France vs Senegal:", e.message);
  }
}

main().catch(console.error);
