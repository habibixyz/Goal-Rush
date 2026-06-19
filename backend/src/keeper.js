/**
 * keeper.js — GoalRush Match Keeper (runs inside Railway backend)
 * ================================================================
 * Runs as a cron job every 60s alongside the Express server.
 * 
 * Responsibilities:
 *   1. Poll ESPN World Cup scoreboard (yesterday → +2 days)
 *   2. createMatch() on-chain for any fixture ≤ 5 min before kickoff
 *      (or already live) that isn't yet registered
 *   3. resolveMatch() on-chain for any STATUS_FULL_TIME fixture
 *      that hasn't been resolved yet
 *
 * Required Railway env vars:
 *   KEEPER_PRIVATE_KEY   — private key of wallet with owner rights on Hook
 *   HOOK_ADDRESS         — GoalRush Hook contract (default filled below)
 *   XLAYER_RPC           — X Layer mainnet RPC (default filled below)
 */

'use strict';

const https  = require('https');
const { ethers } = require('ethers');

// ── Configuration (override via Railway env vars) ────────────
const HOOK_ADDRESS         = process.env.HOOK_ADDRESS   || '0xf568f5343116D369a7C7a50E69C7F89B79A65E37';
const RPC_URL              = process.env.XLAYER_RPC     || process.env.XLAYER_MAINNET_RPC || 'https://rpc.xlayer.tech';
const PRIVATE_KEY          = process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY;
const PRE_ACTIVATE_WINDOW  = 5 * 60;  // activate 5 minutes before kickoff (seconds)
const MATCH_DURATION       = 110 * 60; // on-chain match window: 110 minutes (fallback)

const HOOK_ABI = [
  'function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external',
  'function resolveMatch(uint256 _matchId, uint8 _winner) external',
  'function activeMatchId() external view returns (uint256)',
  'function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)',
];

// ── Module-level singletons (lazy-initialised) ───────────────
let provider = null;
let wallet   = null;
let hook     = null;
let ready    = false;

// Track tx hashes sent this session to avoid re-submitting
const activatedIds  = new Set();
const resolvedIds   = new Set();

// ── Helpers ──────────────────────────────────────────────────
function log(msg) {
  console.log(`[KEEPER ${new Date().toISOString()}] ${msg}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('ESPN timeout')); });
  });
}

function espnIdToOnChain(espnId) {
  // Must match what the frontend does: keccak256("espn_<id>")
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(`espn_${espnId}`)));
}

function getWinnerCode(event) {
  const comps = event.competitions?.[0]?.competitors || [];
  const home  = comps.find(c => c.homeAway === 'home');
  const away  = comps.find(c => c.homeAway === 'away');
  if (!home || !away) return 0;
  const h = parseInt(home.score || '0', 10);
  const a = parseInt(away.score || '0', 10);
  if (h > a) return 1; // teamA (home) wins
  if (a > h) return 2; // teamB (away) wins
  return 0;             // draw
}

async function fetchESPNEvents() {
  const now = new Date();

  const fmt = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const start = new Date(now); start.setUTCDate(start.getUTCDate() - 1);
  const end   = new Date(now); end.setUTCDate(end.getUTCDate() + 2);

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fmt(start)}-${fmt(end)}`;
  const data = await httpGet(url);
  return data.events || [];
}

// ── Initialise contract connection ───────────────────────────
function init() {
  if (!PRIVATE_KEY) {
    log('⚠️  KEEPER_PRIVATE_KEY not set — keeper disabled');
    return false;
  }
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
    hook     = new ethers.Contract(HOOK_ADDRESS, HOOK_ABI, wallet);
    ready    = true;
    log(`✅ Keeper initialised — wallet: ${wallet.address}, hook: ${HOOK_ADDRESS}`);
    return true;
  } catch (err) {
    log(`❌ Keeper init failed: ${err.message}`);
    return false;
  }
}

// ── Core tick ────────────────────────────────────────────────
async function tick() {
  if (!ready) return;

  log('── tick start ──');

  let events;
  try {
    events = await fetchESPNEvents();
    log(`ESPN: ${events.length} event(s)`);
  } catch (err) {
    log(`ESPN fetch failed: ${err.message}`);
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);

  for (const event of events) {
    const espnId    = event.id;
    const status    = event.status?.type?.name || '';
    const comps     = event.competitions?.[0];
    const competitors = comps?.competitors || [];

    const home = competitors.find(c => c.homeAway === 'home');
    const away = competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const teamA      = home.team?.displayName || home.team?.name || 'Team A';
    const teamB      = away.team?.displayName || away.team?.name || 'Team B';
    const kickoffISO = comps?.date || event.date;
    const kickoffSec = kickoffISO ? Math.floor(new Date(kickoffISO).getTime() / 1000) : null;
    const onChainId  = espnIdToOnChain(espnId);
    const idStr      = onChainId.toString();

    const isScheduled = status === 'STATUS_SCHEDULED' || status === 'STATUS_PREGAME';
    const isLive      = status === 'STATUS_IN_PROGRESS' || status === 'STATUS_HALFTIME';
    const isFull      = status === 'STATUS_FULL_TIME'   || status === 'STATUS_FINAL' ||
                        status === 'STATUS_FT'           || status === 'STATUS_FINAL_AET';

    // ── Activation ───────────────────────────────────────────
    if ((isScheduled || isLive) && !activatedIds.has(idStr)) {
      const secsUntil = kickoffSec ? kickoffSec - nowSec : null;
      const shouldActivate = isLive || (secsUntil !== null && secsUntil <= PRE_ACTIVATE_WINDOW);

      if (shouldActivate) {
        // Check on-chain first to avoid wasting gas
        let existsOnChain = false;
        try {
          const chainMatch = await hook.matches(onChainId);
          existsOnChain = chainMatch.id !== 0n;
        } catch (_) {}

        if (!existsOnChain) {
          log(`🚀 Activating: ESPN ${espnId} — ${teamA} vs ${teamB}`);
          try {
            const feeData = await provider.getFeeData();
            const dynamicDuration = Math.max(110 * 60, (secsUntil || 0) + 110 * 60);
            const tx = await hook.createMatch(onChainId, teamA, teamB, dynamicDuration, {
              gasPrice: feeData.gasPrice,
              gasLimit: 300_000,
            });
            log(`   ↪ TX: ${tx.hash}`);
            await tx.wait(1);
            log(`   ✅ Activated!`);
            activatedIds.add(idStr);
          } catch (err) {
            if (err.message?.includes('already exists')) {
              log(`   ℹ️  Already registered`);
              activatedIds.add(idStr); // don't retry
            } else {
              log(`   ❌ createMatch error: ${err.message}`);
            }
          }
        } else {
          activatedIds.add(idStr); // on-chain already, remember it
          log(`   ℹ️  ${teamA} vs ${teamB} already on-chain`);
        }
      } else {
        const min = secsUntil ? Math.ceil(secsUntil / 60) : '?';
        log(`  ⏳ ${teamA} vs ${teamB} — ${min}min to kickoff`);
      }
    }

    // ── Resolution ───────────────────────────────────────────
    if (isFull && !resolvedIds.has(idStr)) {
      let chainMatch;
      try {
        chainMatch = await hook.matches(onChainId);
      } catch (_) { continue; }

      const existsOnChain   = chainMatch.id !== 0n;
      const resolvedOnChain = chainMatch.resolved;

      if (existsOnChain && !resolvedOnChain) {
        const winner = getWinnerCode(event);
        log(`🏁 Resolving: ${teamA} vs ${teamB} — winner=${winner}`);
        try {
          const feeData = await provider.getFeeData();
          const tx = await hook.resolveMatch(onChainId, winner, {
            gasPrice: feeData.gasPrice,
            gasLimit: 200_000,
          });
          log(`   ↪ TX: ${tx.hash}`);
          await tx.wait(1);
          log(`   ✅ Resolved!`);
          resolvedIds.add(idStr);
        } catch (err) {
          if (err.message?.includes('already resolved')) {
            log(`   ℹ️  Already resolved`);
            resolvedIds.add(idStr);
          } else {
            log(`   ❌ resolveMatch error: ${err.message}`);
          }
        }
      } else if (resolvedOnChain) {
        resolvedIds.add(idStr);
      }
    }
  }

  // Log active match
  try {
    const activeId = await hook.activeMatchId();
    if (activeId !== 0n) {
      const m = await hook.matches(activeId);
      log(`📌 Active match: ${m.teamA} vs ${m.teamB}`);
    }
  } catch (_) {}

  log('── tick end ──');
}

// ── Public API ────────────────────────────────────────────────
// Call startKeeper() from server.js after boot
function startKeeper(cron) {
  if (!init()) return; // disabled — no key

  // Immediate first tick
  tick().catch(err => log(`First tick error: ${err.message}`));

  // Then every 60 seconds via node-cron
  cron.schedule('* * * * *', () => {
    tick().catch(err => log(`Tick error: ${err.message}`));
  });

  log('🤖 Keeper scheduled — every 60s');
}

module.exports = { startKeeper };
