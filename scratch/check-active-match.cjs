const { ethers } = require('ethers');

async function main() {
  const p = new ethers.JsonRpcProvider("https://xlayer-mainnet.rpc.sentio.xyz");
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  
  const abi = [
    'function activeMatchId() external view returns (uint256)',
    'function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)'
  ];
  
  const hook = new ethers.Contract(hookAddress, abi, p);
  
  try {
    const activeMatchId = await hook.activeMatchId();
    console.log("Active Match ID:", activeMatchId.toString());
    
    if (activeMatchId > 0n) {
      const m = await hook.matches(activeMatchId);
      console.log(`Match Details: ${m.teamA} vs ${m.teamB}`);
      console.log(`Start Time: ${new Date(Number(m.startTime) * 1000).toLocaleString()}`);
      console.log(`End Time: ${new Date(Number(m.endTime) * 1000).toLocaleString()}`);
      console.log(`Resolved: ${m.resolved}`);
    } else {
      console.log("No active match is currently set on the hook.");
    }
  } catch(e) {
    console.error("Error querying hook:", e);
  }
}
main();
