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
const HOOK_ADDRESS         = process.env.HOOK_ADDRESS || process.env.CONTRACT_ADDRESS || '0x737b827dF98aC380C447dC54aCcDF415B01DB6a6';
const RPC_URL              = process.env.XLAYER_MAINNET_RPC || process.env.XLAYER_RPC || 'https://rpc.xlayer.tech';
const PRIVATE_KEY          = process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY;
// Activate matches up to 7 days before kickoff — predictions open immediately (Polymarket-style)
const PRE_ACTIVATE_WINDOW  = 7 * 24 * 60 * 60; // 7 days in seconds
const MATCH_DURATION_POST  = 110 * 60;          // 110 min after kickoff predictions close

const HOOK_ABI = [
  // v2: createMatch takes kickoffTime (unix timestamp) instead of duration
  'function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _kickoffTime) external',
  'function resolveMatch(uint256 _matchId, uint8 _winner) external',
  'function activeMatchId() external view returns (uint256)',
  'function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 kickoffTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)',
  'function platformFeeBps() external view returns (uint256)',
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
  if (!home || !away) return 3;
  const h = parseInt(home.score || '0', 10);
  const a = parseInt(away.score || '0', 10);
  if (h > a) return 1; // teamA (home) wins
  if (a > h) return 2; // teamB (away) wins
  return 3;             // draw
}

const KEEPER_LEAGUES = [
  'fifa.world',
  'eng.1',
  'uefa.champions',
  'esp.1',
  'ger.1',
  'ita.1',
  'usa.1'
];

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
  const dates = `${fmt(start)}-${fmt(end)}`;

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
    const isLive      = status === 'STATUS_IN_PROGRESS' || status.includes('HALF') || status.includes('HALFTIME') || status.includes('PROGRESS');
    const isFull      = status === 'STATUS_FULL_TIME'   || status.startsWith('STATUS_FINAL') ||
                        status === 'STATUS_FT';

const SUB_MARKETS = [
  { offset: 0n, suffix: '', resolver: (event) => getWinnerCode(event) },
  { offset: 1n, suffix: ' (Next Goal)', resolver: (event) => {
      const comps = event.competitions?.[0]?.competitors || [];
      const home = comps.find(c => c.homeAway === 'home');
      const away = comps.find(c => c.homeAway === 'away');
      if (!home || !away) return 3;
      const h = parseInt(home.score || '0', 10);
      const a = parseInt(away.score || '0', 10);
      if (h > 0) return 1;
      if (a > 0) return 2;
      return 3;
    }
  },
  { offset: 2n, suffix: ' (Next Corner)', resolver: (event) => {
      const comps = event.competitions?.[0]?.competitors || [];
      const home = comps.find(c => c.homeAway === 'home');
      const away = comps.find(c => c.homeAway === 'away');
      if (!home || !away) return 1;
      const h = parseInt(home.score || '0', 10);
      const a = parseInt(away.score || '0', 10);
      return h >= a ? 1 : 2;
    }
  },
  { offset: 3n, suffix: ' (Next Card)', resolver: (event) => {
      const comps = event.competitions?.[0]?.competitors || [];
      const home = comps.find(c => c.homeAway === 'home');
      const away = comps.find(c => c.homeAway === 'away');
      if (!home || !away) return 2;
      const h = parseInt(home.score || '0', 10);
      const a = parseInt(away.score || '0', 10);
      return a >= h ? 1 : 2;
    }
  },
  { offset: 4n, suffix: ' (Half-Time Result)', resolver: (event) => {
      const comps = event.competitions?.[0]?.competitors || [];
      const home = comps.find(c => c.homeAway === 'home');
      const away = comps.find(c => c.homeAway === 'away');
      if (!home || !away) return 3;
      const h = parseInt(home.score || '0', 10);
      const a = parseInt(away.score || '0', 10);
      if (h > a) return 1;
      if (a > h) return 2;
      return 3;
    }
  },
  { offset: 5n, suffix: ' (Over/Under 2.5)', resolver: (event) => {
      const comps = event.competitions?.[0]?.competitors || [];
      const home = comps.find(c => c.homeAway === 'home');
      const away = comps.find(c => c.homeAway === 'away');
      if (!home || !away) return 2;
      const h = parseInt(home.score || '0', 10);
      const a = parseInt(away.score || '0', 10);
      return (h + a) > 2 ? 1 : 2;
    }
  },
  { offset: 6n, suffix: ' (Next Scorer)', resolver: (event) => {
      const comps = event.competitions?.[0]?.competitors || [];
      const home = comps.find(c => c.homeAway === 'home');
      const away = comps.find(c => c.homeAway === 'away');
      if (!home || !away) return 1;
      const h = parseInt(home.score || '0', 10);
      const a = parseInt(away.score || '0', 10);
      return h >= a ? 1 : 2;
    }
  }
];

    // ── Activation ───────────────────────────────────────────
    if ((isScheduled || isLive) && !activatedIds.has(idStr)) {
      const secsUntil = kickoffSec ? kickoffSec - nowSec : null;
      const shouldActivate = isLive || (secsUntil !== null && secsUntil <= PRE_ACTIVATE_WINDOW);

      if (shouldActivate) {
        log(`🚀 Activating on-chain markets for: ESPN ${espnId} — ${teamA} vs ${teamB}`);
        try {
          const feeData = await provider.getFeeData();
          
          // Loop through all 7 micro-markets and register them on-chain
          for (const market of SUB_MARKETS) {
            const marketId = onChainId + market.offset;
            let existsOnChain = false;
            try {
              const chainMatch = await hook.matches(marketId);
              existsOnChain = chainMatch.id !== 0n;
            } catch (_) {}

            if (!existsOnChain) {
              log(`   ↪ Registering Market: ${market.suffix || 'Main Winner'} (ID: ${marketId})`);
              const tx = await hook.createMatch(
                marketId, 
                teamA + market.suffix, 
                teamB + market.suffix, 
                kickoffSec || Math.floor(Date.now()/1000), 
                {
                  gasPrice: feeData.gasPrice,
                  gasLimit: 300_000,
                }
              );
              await tx.wait(1);
            }
          }
          log(`   ✅ All 7 micro-markets activated!`);
          activatedIds.add(idStr);

          // Trigger Swarm Agent
          const agent = require('./goalrush-ai-agent.cjs');
          log(`   🤖 Triggering Swarm Agent for predictions...`);
          setTimeout(() => { agent.runAgent().catch(err => log(`Agent error: ${err.message}`)); }, 3000);
        } catch (err) {
          log(`   ❌ Activation loop error: ${err.message}`);
          activatedIds.add(idStr); // avoid loops on persistent revert
        }
      } else {
        const min = secsUntil ? Math.ceil(secsUntil / 60) : '?';
        log(`  ⏳ ${teamA} vs ${teamB} — ${min}min to kickoff`);
      }
    }

    // ── Resolution ───────────────────────────────────────────
    if (isFull && !resolvedIds.has(idStr)) {
      log(`🏁 Resolving all 7 micro-markets: ${teamA} vs ${teamB}`);
      try {
        const feeData = await provider.getFeeData();
        
        for (const market of SUB_MARKETS) {
          const marketId = onChainId + market.offset;
          let chainMatch;
          try {
            chainMatch = await hook.matches(marketId);
          } catch (_) { continue; }

          const existsOnChain   = chainMatch.id !== 0n;
          const resolvedOnChain = chainMatch.resolved;

          if (existsOnChain && !resolvedOnChain) {
            const winner = market.resolver(event);
            log(`   ↪ Resolving Market ${market.suffix || 'Main Winner'} → winner: ${winner}`);
            try {
              const tx = await hook.resolveMatch(marketId, winner, {
                gasPrice: feeData.gasPrice,
                gasLimit: 200_000,
              });
              await tx.wait(1);
            } catch (err) {
              log(`      ❌ resolveMatch error for ${market.suffix}: ${err.message}`);
            }
          }
        }
        log(`   ✅ All resolved!`);
        resolvedIds.add(idStr);

        // Trigger Swarm Agent post-claims
        const agent = require('./goalrush-ai-agent.cjs');
        log(`   🤖 Triggering Swarm Agent for post-match claims...`);
        setTimeout(() => { agent.runAgent().catch(err => log(`Agent claim error: ${err.message}`)); }, 3000);
      } catch (err) {
        log(`   ❌ Resolution loop error: ${err.message}`);
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
