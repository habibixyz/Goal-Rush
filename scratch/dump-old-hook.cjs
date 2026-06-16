const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const oldHook = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";
  const startBlock = 62494373;
  const endBlock = 62703412;

  const hookContract = new ethers.Contract(oldHook, [
    "event GoalScored(address indexed swapper, uint256 bonusAmount)",
    "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
    "event GrushPredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)"
  ], rpcProvider);

  const logsGoalScored = await hookContract.queryFilter(hookContract.filters.GoalScored(), startBlock, endBlock).catch(() => []);
  const logsPrediction = await hookContract.queryFilter(hookContract.filters.PredictionPlaced(), startBlock, endBlock).catch(() => []);
  const logsGrush = await hookContract.queryFilter(hookContract.filters.GrushPredictionPlaced(), startBlock, endBlock).catch(() => []);

  console.log(`Old Hook GoalScored events: ${logsGoalScored.length}`);
  logsGoalScored.forEach(log => console.log(`- GoalScored: Swapper ${log.args[0]}, Bonus: ${ethers.formatEther(log.args[1])}`));

  console.log(`Old Hook PredictionPlaced events: ${logsPrediction.length}`);
  logsPrediction.forEach(log => console.log(`- PredictionPlaced: User ${log.args[0]}, Match: ${log.args[1]}, Team: ${log.args[2]}, Vol: ${ethers.formatEther(log.args[3])}`));

  console.log(`Old Hook GrushPredictionPlaced events: ${logsGrush.length}`);
  logsGrush.forEach(log => console.log(`- GrushPredictionPlaced: User ${log.args[0]}, Match: ${log.args[1]}, Team: ${log.args[2]}, Vol: ${ethers.formatEther(log.args[3])}`));
}

main().catch(console.error);
