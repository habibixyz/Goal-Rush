const { ethers } = require("ethers");
const db = require("./db");

const HOOK_ADDRESS = "0xf568f5343116D369a7C7a50E69C7F89B79A65E37";
const RPC_URL = "https://rpc.xlayer.tech";
const PREDICTION_DURATION = 9000; // 2.5 hours in seconds

// How many minutes before kickoff to pre-activate a match (5 minutes)
const PRE_ACTIVATE_MINUTES = 5;

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
  const kickoffMs = new Date(match.kickoff_utc).getTime();
  const secsUntil = Math.max(0, Math.floor((kickoffMs - Date.now()) / 1000));
  const dynamicDuration = secsUntil + 110 * 60;

  const tx = await hook.createMatch(numericId, match.home_team, match.away_team, dynamicDuration);
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
    const upcomingMatches = db.getUpcomingMatches(30 * 24) || []; // next 30 days
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
