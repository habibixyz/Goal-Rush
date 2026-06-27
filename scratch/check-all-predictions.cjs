const { ethers } = require('ethers');
async function main() {
  const p = new ethers.JsonRpcProvider("https://xlayer-mainnet.rpc.sentio.xyz");
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  
  const abi = [
    "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)"
  ];
  
  const hook = new ethers.Contract(hookAddress, abi, p);
  console.log("Fetching all predictions on the hook...");
  const logs = await hook.queryFilter(hook.filters.PredictionPlaced(), 0, "latest");
  console.log(`Found ${logs.length} predictions in total.`);
  for(let log of logs) {
    console.log(`User: ${log.args.user} - Match: ${log.args.matchId} - Team: ${log.args.team}`);
  }
}
main().catch(console.error);
