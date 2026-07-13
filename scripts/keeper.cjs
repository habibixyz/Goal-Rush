/**
 * ============================================================
 *  GoalRush Match Keeper Bot  v2.0
 * ============================================================
 *  Runs 24/7. Every 60 seconds it:
 *    1. Fetches upcoming / live World Cup fixtures from ESPN
 *    2. Activates any match that is ≤ 5 min away from kickoff
 *       (calls createMatch on-chain if it does not already exist)
 *    3. Resolves any match that ESPN marks as STATUS_FULL_TIME
 *       and is not yet resolved on-chain
 *    4. Logs every action with timestamp so you can debug anytime
 *
 *  Usage:
 *    node scripts/keeper.cjs
 *
 *  Keeps running indefinitely. Use pm2 / NSSM to daemonize it.
 * ============================================================
 */

'use strict';

const https  = require('https');
const { ethers } = require('ethers');
require('dotenv').config();

// ── Configuration ────────────────────────────────────────────
const HOOK_ADDRESS   = '0x700656337a252A004Ca0B170828f4adEaa680288';
const RPC_URL        = process.env.XLAYER_MAINNET_RPC || 'https://rpc.xlayer.tech';
const PRIVATE_KEY    = process.env.PRIVATE_KEY;
const POLL_INTERVAL  = 60_000;          // check every 60 seconds
const PRE_ACTIVATE_WINDOW = 5 * 60;    // activate 5 minutes before kickoff (seconds)
const MATCH_DURATION = 110 * 60;        // on-chain match window: 110 minutes (fallback)

// Minimal ABI — only the functions the keeper needs
const HOOK_ABI = [
  'function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external',
  'function resolveMatch(uint256 _matchId, uint8 _winner) external',
  'function activeMatchId() external view returns (uint256)',
  'function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)',
];

// ── Helpers ──────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

/**
 * Fetch ESPN fixtures for a date range (YYYYMMDD-YYYYMMDD)
 */
const KEEPER_LEAGUES = [
  'fifa.world',
  'eng.1',
  'uefa.champions',
  'esp.1',
  'ger.1',
  'ita.1',
  'usa.1'
];

async function fetchESPN() {
  const now = new Date();
  const fmt = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);

  const start = fmt(yesterday);
  const end   = fmt(tomorrow);
  const dates = `${start}-${end}`;

  const allEvents = [];
  for (const leagueId of KEEPER_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard?dates=${dates}`;
      const data = await httpGet(url);
      if (data.events && data.events.length > 0) {
        allEvents.push(...data.events);
      }
    } catch (err) {
      log(`⚠️ ESPN fetch failed for league ${leagueId}: ${err.message}`);
    }
  }
  return allEvents;
}

/**
 * Deterministically derive the on-chain uint256 match ID from an ESPN event ID.
 * We use keccak256("espn_<id>") to match what the frontend does.
 */
function espnIdToOnChain(espnId) {
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(`espn_${espnId}`)));
}

/**
 * Determine winner code from ESPN event:
 *   0 = draw, 1 = teamA (home), 2 = teamB (away)
 */
function getWinner(event) {
  const comps = event.competitions?.[0]?.competitors || [];
  const home = comps.find(c => c.homeAway === 'home');
  const away = comps.find(c => c.homeAway === 'away');
  if (!home || !away) return 3;
  const hScore = parseInt(home.score || '0', 10);
  const aScore = parseInt(away.score || '0', 10);
  if (hScore > aScore) return 1;
  if (aScore > hScore) return 2;
  return 3; // draw
}

// ── Keeper loop ───────────────────────────────────────────────
async function tick(hook, wallet) {
  log('─── Keeper tick ───');

  let events;
  try {
    events = await fetchESPN();
    log(`ESPN returned ${events.length} event(s)`);
  } catch (err) {
    log(`⚠️  ESPN fetch failed: ${err.message}`);
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  for (const event of events) {
    const espnId    = event.id;
    const matchName = event.name || espnId;
    const status    = event.status?.type?.name || '';
    const comps     = event.competitions?.[0];
    const competitors = comps?.competitors || [];

    const home = competitors.find(c => c.homeAway === 'home');
    const away = competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const teamA       = home.team?.displayName || home.team?.name || 'Team A';
    const teamB       = away.team?.displayName || away.team?.name || 'Team B';
    const kickoffISO  = comps?.date || event.date;
    const kickoffSec  = kickoffISO ? Math.floor(new Date(kickoffISO).getTime() / 1000) : null;
    const onChainId   = espnIdToOnChain(espnId);

    // ── Query on-chain state ─────────────────────────────────
    let chainMatch;
    try {
      chainMatch = await hook.matches(onChainId);
    } catch (err) {
      log(`  ⚠️  Could not query on-chain state for ${matchName}: ${err.message}`);
      continue;
    }

    const existsOnChain  = chainMatch.id !== 0n;
    const resolvedOnChain = chainMatch.resolved;

    // ── ACTIVATION: register match ≤ 5 min before kickoff ────
    const isScheduled = status === 'STATUS_SCHEDULED' || status === 'STATUS_PREGAME';
    const isLive      = status === 'STATUS_IN_PROGRESS' || status.includes('HALF') || status.includes('HALFTIME') || status.includes('PROGRESS');
    const isFull      = status === 'STATUS_FULL_TIME'   || status.startsWith('STATUS_FINAL') ||
                        status === 'STATUS_FT';

    if (!existsOnChain && (isScheduled || isLive)) {
      const secsUntilKickoff = kickoffSec ? kickoffSec - nowSec : null;
      const shouldActivate =
        isLive ||  // already live but never registered
        (secsUntilKickoff !== null && secsUntilKickoff <= PRE_ACTIVATE_WINDOW);

      if (shouldActivate) {
        log(`🚀 Activating on-chain: "${matchName}" (ESPN ${espnId}) — ${teamA} vs ${teamB}`);
        try {
          // Calculate dynamic duration so prediction window closes 110 minutes after actual kickoff time
          const dynamicDuration = Math.max(110 * 60, (secsUntilKickoff || 0) + 110 * 60);

          const gasPrice = (await wallet.provider.getFeeData()).gasPrice;
          const tx = await hook.createMatch(onChainId, teamA, teamB, dynamicDuration, {
            gasPrice,
            gasLimit: 300_000
          });
          log(`   ↪ TX submitted: ${tx.hash}`);
          await tx.wait(1);
          log(`   ✅ Match activated on-chain!`);
        } catch (err) {
          // "Match already exists" is benign — ignore it
          if (err.message?.includes('already exists')) {
            log(`   ℹ️  Match already registered, skipping.`);
          } else {
            log(`   ❌ createMatch failed: ${err.message}`);
          }
        }
        continue; // skip resolve check this tick
      } else {
        const minLeft = secsUntilKickoff ? Math.ceil(secsUntilKickoff / 60) : '?';
        log(`  ⏳ ${matchName} — ${minLeft} min to kickoff, not yet activating`);
      }
    }

    // ── RESOLUTION: mark finished matches on-chain ────────────
    if (existsOnChain && !resolvedOnChain && isFull) {
      const winner = getWinner(event);
      log(`🏁 Resolving on-chain: "${matchName}" — winner code ${winner}`);
      try {
        const gasPrice = (await wallet.provider.getFeeData()).gasPrice;
        const tx = await hook.resolveMatch(onChainId, winner, {
          gasPrice,
          gasLimit: 200_000
        });
        log(`   ↪ TX submitted: ${tx.hash}`);
        await tx.wait(1);
        log(`   ✅ Match resolved on-chain!`);
      } catch (err) {
        if (err.message?.includes('already resolved')) {
          log(`   ℹ️  Match already resolved, skipping.`);
        } else {
          log(`   ❌ resolveMatch failed: ${err.message}`);
        }
      }
    }
  }

  // ── Show current active match ─────────────────────────────
  try {
    const activeId = await hook.activeMatchId();
    if (activeId !== 0n) {
      const active = await hook.matches(activeId);
      log(`📌 Active on-chain match: ${active.teamA} vs ${active.teamB} (ID ${activeId})`);
    } else {
      log(`📌 No active match on-chain right now.`);
    }
  } catch (_) {}

  log('─── Tick done ───');
}

// ── Entry point ───────────────────────────────────────────────
async function main() {
  if (!PRIVATE_KEY || PRIVATE_KEY === '0x0000000000000000000000000000000000000000000000000000000000000001') {
    console.error('❌ PRIVATE_KEY not set in .env — cannot sign transactions!');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const hook     = new ethers.Contract(HOOK_ADDRESS, HOOK_ABI, wallet);

  log(`GoalRush Keeper Bot started`);
  log(`  Hook:    ${HOOK_ADDRESS}`);
  log(`  Wallet:  ${wallet.address}`);
  log(`  RPC:     ${RPC_URL}`);
  log(`  Poll:    every ${POLL_INTERVAL / 1000}s`);
  log(`  Window:  activate ${PRE_ACTIVATE_WINDOW / 60}min before kickoff`);

  // First tick immediately, then on interval
  await tick(hook, wallet);
  setInterval(async () => {
    try { await tick(hook, wallet); }
    catch (err) { log(`💥 Unhandled error in tick: ${err.message}`); }
  }, POLL_INTERVAL);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
