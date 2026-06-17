const { ethers } = require("ethers");
const db = require("./db");

const HOOK_ADDRESS = "0xC907030AeCd8fC81B19678cDD08DCF96cD9380c0";
const RPC_URL = "https://rpc.xlayer.tech";
const PREDICTION_DURATION = 9000; // 2.5 hours in seconds

const abi = [
  "function activeMatchId() view returns (uint256)",
  "function matches(uint256) view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
  "function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration)"
];

function getNumericMatchId(matchId) {
  if (!matchId) return 0n;
  const s = String(matchId);
  if (/^\d+$/.test(s)) return BigInt(s);
  return BigInt(ethers.id(s));
}

async function runKeeper() {
  try {
    const pk = process.env.KEEPER_PRIVATE_KEY;
    if (!pk) {
      // Silently return if no keeper key is configured
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(pk, provider);
    const hook = new ethers.Contract(HOOK_ADDRESS, abi, wallet);

    // Get any live matches from the local database
    const liveMatches = db.getLiveMatches();
    if (!liveMatches || liveMatches.length === 0) {
      return;
    }

    // Grab the first live match (or prioritize one)
    const activeLive = liveMatches[0];
    const numericId = getNumericMatchId(activeLive.id);

    // Check what the contract currently considers the active match
    const currentActiveId = await hook.activeMatchId();

    if (currentActiveId === numericId) {
      // Match is already the primary active match. Nothing to do.
      return;
    }

    // Check if the match has already been created (maybe just not set as active)
    const matchData = await hook.matches(numericId);
    if (matchData[0] === numericId) {
      // Match exists on-chain, but is not the activeMatchId.
      // Since createMatch reverts if it already exists, we skip.
      return;
    }

    console.log(`[KEEPER] Automating match instantiation for ${activeLive.home_team} vs ${activeLive.away_team} (ID: ${numericId.toString()})`);

    // Submit transaction
    const tx = await hook.createMatch(numericId, activeLive.home_team, activeLive.away_team, PREDICTION_DURATION);
    console.log(`[KEEPER] Transaction submitted: ${tx.hash}`);
    
    // Wait for 1 confirmation
    await tx.wait(1);
    console.log(`[KEEPER] Match successfully instantiated on-chain!`);

  } catch (error) {
    // Only log the error briefly, do not crash the backend loop
    console.warn("[KEEPER] Error during execution:", error.message);
  }
}

module.exports = {
  runKeeper
};
