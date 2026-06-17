const { ethers } = require("ethers");

const RPC = "https://rpc.xlayer.tech";
const HOOKS = [
  "0xC907030AeCd8fC81B19678cDD08DCF96cD9380c0",
  "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0",
  "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0",
  "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0",
  "0xe1Ad1C1Ab7600E6c3Fbaf0c80c3b947B7F901B7F"
];

const ABI = [
  "function activeMatchId() view returns (uint256)",
  "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const franceSenegalId = BigInt(ethers.id("espn_760432"));
  console.log("France vs Senegal numeric ID:", franceSenegalId.toString());

  for (const hookAddress of HOOKS) {
    console.log(`\nQuerying Hook: ${hookAddress}`);
    try {
      const hook = new ethers.Contract(hookAddress, ABI, provider);
      const activeId = await hook.activeMatchId();
      console.log(`  Active Match ID: ${activeId.toString()}`);

      // Query by espn_760432
      const matchData = await hook.matches(franceSenegalId);
      if (matchData[0] > 0n) {
        console.log(`  Match by ID espn_760432 details:`, {
          id: matchData[0].toString(),
          teamA: matchData[1],
          teamB: matchData[2],
          resolved: matchData[5],
          winner: matchData[6].toString()
        });
      } else {
        console.log(`  Match by ID espn_760432 does not exist on this contract.`);
      }

      // Query by ID 10
      const match10Data = await hook.matches(10n);
      if (match10Data[0] > 0n) {
        console.log(`  Match #10 details:`, {
          id: match10Data[0].toString(),
          teamA: match10Data[1],
          teamB: match10Data[2],
          resolved: match10Data[5],
          winner: match10Data[6].toString()
        });
      }
    } catch (e) {
      console.log(`  Error querying: ${e.message}`);
    }
  }
}

main().catch(console.error);
