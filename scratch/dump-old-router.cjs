const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const oldRouter = "0xe1Ad1C1Ab7600E6c3Fbaf0c80c3b947B7F901B7F";
  const startBlock = 62494373;
  const endBlock = 62703412;

  const routerContract = new ethers.Contract(oldRouter, [
    "event PredictionDeposited(address indexed user, uint8 indexed team, uint256 amount)",
    "event GrushPredictionDeposited(address indexed user, uint8 indexed team, uint256 amount)"
  ], rpcProvider);

  const logsOkb = await routerContract.queryFilter(routerContract.filters.PredictionDeposited(), startBlock, endBlock).catch(() => []);
  const logsGrush = await routerContract.queryFilter(routerContract.filters.GrushPredictionDeposited(), startBlock, endBlock).catch(() => []);

  console.log(`Old Router PredictionDeposited events: ${logsOkb.length}`);
  logsOkb.forEach(log => console.log(`- OKB Deposit: User ${log.args[0]}, Team: ${log.args[1]}, Amount: ${ethers.formatEther(log.args[2])}`));

  console.log(`Old Router GrushPredictionDeposited events: ${logsGrush.length}`);
  logsGrush.forEach(log => console.log(`- GRUSH Deposit: User ${log.args[0]}, Team: ${log.args[1]}, Amount: ${ethers.formatEther(log.args[2])}`));
}

main().catch(console.error);
