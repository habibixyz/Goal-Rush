const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const olderHook1 = "0x16756EF929311280af22395e9FFB91b5Fa3d00c0";
  const olderHook2 = "0xb4f86ecb09BE1FeEbc09C2322A67557F145280c0";
  const startBlock = 62494373;
  const endBlock = 62793000;

  const hookAbi = [
    "event GoalScored(address indexed swapper, uint256 bonusAmount)",
    "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)"
  ];

  const contract1 = new ethers.Contract(olderHook1, hookAbi, rpcProvider);
  const contract2 = new ethers.Contract(olderHook2, hookAbi, rpcProvider);

  try {
    const goals1 = await contract1.queryFilter(contract1.filters.GoalScored(), startBlock, endBlock).catch(() => []);
    const preds1 = await contract1.queryFilter(contract1.filters.PredictionPlaced(), startBlock, endBlock).catch(() => []);
    console.log(`Hook ${olderHook1} GoalScored: ${goals1.length}, PredictionPlaced: ${preds1.length}`);
    goals1.forEach(g => console.log(` - GoalScored: Swapper ${g.args[0]}`));
    preds1.forEach(p => console.log(` - PredictionPlaced: User ${p.args[0]}, Vol: ${ethers.formatEther(p.args[3])}`));
  } catch (e) {
    console.error(`Error querying ${olderHook1}:`, e.message);
  }

  try {
    const goals2 = await contract2.queryFilter(contract2.filters.GoalScored(), startBlock, endBlock).catch(() => []);
    const preds2 = await contract2.queryFilter(contract2.filters.PredictionPlaced(), startBlock, endBlock).catch(() => []);
    console.log(`Hook ${olderHook2} GoalScored: ${goals2.length}, PredictionPlaced: ${preds2.length}`);
    goals2.forEach(g => console.log(` - GoalScored: Swapper ${g.args[0]}`));
    preds2.forEach(p => console.log(` - PredictionPlaced: User ${p.args[0]}, Vol: ${ethers.formatEther(p.args[3])}`));
  } catch (e) {
    console.error(`Error querying ${olderHook2}:`, e.message);
  }
}

main().catch(console.error);
