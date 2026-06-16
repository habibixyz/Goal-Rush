const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const oldHook = "0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0";
  const oldRouter = "0xe1Ad1C1Ab7600E6c3Fbaf0c80c3b947B7F901B7F";
  const newHook = "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0";
  const newRouter = "0xB8332a105f2ea7F53Bd94554F74658Bf767f8D67";
  
  const startBlock = 62494373;
  const latestBlock = await rpcProvider.getBlockNumber();
  
  console.log(`Scanning from block ${startBlock} to ${latestBlock}...`);
  
  const hookAbi = [
    "event GoalScored(address indexed swapper, uint256 bonusAmount)",
    "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
    "event GrushPredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)"
  ];
  
  const routerInterface = new ethers.Interface([
    "event PredictionDeposited(address indexed user, uint8 indexed team, uint256 amount)",
    "event GrushPredictionDeposited(address indexed user, uint8 indexed team, uint256 amount)"
  ]);

  const hookInterface = new ethers.Interface(hookAbi);

  const stats = {};
  const getOrCreateUser = (addr) => {
    const lower = addr.toLowerCase();
    if (!stats[lower]) {
      stats[lower] = { address: addr, goals: 0, volume: 0n, grushVolume: 0n };
    }
    return stats[lower];
  };

  const chunkSize = 5000;
  for (let from = startBlock; from <= latestBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, latestBlock);
    try {
      const logs = await rpcProvider.getLogs({
        address: [oldHook, oldRouter, newHook, newRouter],
        fromBlock: from,
        toBlock: to
      });

      logs.forEach(log => {
        const addrLower = log.address.toLowerCase();
        if (addrLower === oldHook.toLowerCase() || addrLower === newHook.toLowerCase()) {
          try {
            const parsed = hookInterface.parseLog(log);
            if (parsed) {
              if (parsed.name === "GoalScored") {
                const swapper = parsed.args[0];
                getOrCreateUser(swapper).goals += 1;
              } else if (parsed.name === "PredictionPlaced") {
                const user = parsed.args[0];
                const volume = parsed.args[3];
                getOrCreateUser(user).volume += BigInt(volume);
              } else if (parsed.name === "GrushPredictionPlaced") {
                const user = parsed.args[0];
                const volume = parsed.args[3];
                getOrCreateUser(user).grushVolume += BigInt(volume);
              }
            }
          } catch (_) {}
        } else if (addrLower === oldRouter.toLowerCase() || addrLower === newRouter.toLowerCase()) {
          try {
            const parsed = routerInterface.parseLog(log);
            if (parsed) {
              const user = parsed.args[0];
              const amount = BigInt(parsed.args[parsed.args.length - 1]);
              const isGrush = parsed.name.includes("Grush");
              if (isGrush) {
                getOrCreateUser(user).grushVolume += amount;
              } else {
                getOrCreateUser(user).volume += amount;
              }
            }
          } catch (_) {}
        }
      });
    } catch (err) {
      console.warn(`Chunk ${from}-${to} failed:`, err.message);
    }
  }

  console.log("\n--- CONSOLIDATED LEADERBOARD ---");
  Object.values(stats).forEach(u => {
    console.log(`Address: ${u.address}`);
    console.log(` - Goals: ${u.goals}`);
    console.log(` - OKB Vol: ${ethers.formatEther(u.volume)} OKB`);
    console.log(` - GRUSH Vol: ${ethers.formatEther(u.grushVolume)} GRUSH`);
  });
}

main().catch(console.error);
