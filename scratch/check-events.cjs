const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://xlayer.drpc.org";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const hook = new ethers.Contract(HOOK, [
    "event PredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
    "event GrushPredictionPlaced(address indexed user, uint256 indexed matchId, uint8 team, uint256 volume)",
    "event MatchCreated(uint256 indexed matchId, string teamA, string teamB, uint256 startTime)",
    "event MatchResolved(uint256 indexed matchId, uint8 winner, uint256 jackpotAmount)"
  ], provider);

  const startBlock = 62494373;
  const endBlock = await provider.getBlockNumber();
  console.log(`Scanning from block ${startBlock} to ${endBlock} in chunks of 10,000...`);

  const chunkSize = 10000;
  const created = [];
  const preds = [];
  const grushPreds = [];

  for (let from = startBlock; from <= endBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, endBlock);
    try {
      const cLogs = await hook.queryFilter(hook.filters.MatchCreated(), from, to);
      created.push(...cLogs);
    } catch (e) {
      console.error(`  Error MatchCreated in chunk ${from}-${to}:`, e.message);
    }

    try {
      const pLogs = await hook.queryFilter(hook.filters.PredictionPlaced(), from, to);
      preds.push(...pLogs);
    } catch (e) {
      console.error(`  Error PredictionPlaced in chunk ${from}-${to}:`, e.message);
    }

    try {
      const gLogs = await hook.queryFilter(hook.filters.GrushPredictionPlaced(), from, to);
      grushPreds.push(...gLogs);
    } catch (e) {
      console.error(`  Error GrushPredictionPlaced in chunk ${from}-${to}:`, e.message);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nFound ${created.length} MatchCreated events`);
  console.log(`Found ${preds.length} PredictionPlaced events`);
  console.log(`Found ${grushPreds.length} GrushPredictionPlaced events`);
}

main().catch(console.error);
