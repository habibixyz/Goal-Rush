const { ethers } = require("ethers");
const db = require("./db");

const HOOK_ADDRESS = "0x66ef1ac1B70C6248422B9E30BdD498736d4a1A2B";
const RPC_URL = "https://rpc.xlayer.tech";
const PREDICTION_DURATION = 9000; // 2.5 hours in seconds

// How many minutes before kickoff to pre-activate a match
const PRE_ACTIVATE_MINUTES = 30;

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

async function activateMatchOnChain(hook, match) {
  const numericId = getNumericMatchId(match.id);

  // Check if already created on-chain
  const matchData = await hook.matches(numericId);
  if (matchData[0] !== 0n) {
    console.log(`[KEEPER] Match ${match.home_team} vs ${match.away_team} already on-chain (ID: ${numericId.toString()})`);
    return false; // already exists
  }

  console.log(`[KEEPER] Activating ${match.home_team} vs ${match.away_team} on-chain (ID: ${numericId.toString()})...`);
  const tx = await hook.createMatch(numericId, match.home_team, match.away_team, PREDICTION_DURATION);
  console.log(`[KEEPER] TX submitted: ${tx.hash}`);
  await tx.wait(1);
  console.log(`[KEEPER] ✅ Match activated: ${match.home_team} vs ${match.away_team}`);
  return true;
}

async function runKeeper() {
  try {
    const pk = process.env.PRIVATE_KEY || process.env.KEEPER_PRIVATE_KEY;
    if (!pk) {
      return; // Silently return if no keeper key is configured
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(pk, provider);
    const hook = new ethers.Contract(HOOK_ADDRESS, abi, wallet);

    // Gather candidates: all LIVE matches + upcoming matches starting within PRE_ACTIVATE_MINUTES
    const liveMatches = db.getLiveMatches() || [];
    const upcomingMatches = db.getUpcomingMatches(1) || []; // next 1 hour
    const nowMs = Date.now();
    const soonMatches = upcomingMatches.filter(m => {
      const kickoffMs = new Date(m.kickoff_utc).getTime();
      return kickoffMs - nowMs <= PRE_ACTIVATE_MINUTES * 60 * 1000;
    });

    const candidates = [...liveMatches, ...soonMatches];
    if (candidates.length === 0) {
      return;
    }

    // Try to activate each candidate that isn't on-chain yet
    for (const match of candidates) {
      try {
        await activateMatchOnChain(hook, match);
      } catch (err) {
        console.warn(`[KEEPER] Failed to activate ${match.home_team} vs ${match.away_team}:`, err.message);
      }
    }

  } catch (error) {
    console.warn("[KEEPER] Error during execution:", error.message);
  }
}

module.exports = {
  runKeeper,
  activateMatchOnChain
};
