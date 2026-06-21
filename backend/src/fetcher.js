/**
 * fetcher.js
 * Pulls live + upcoming football data from FREE sources:
 *  1. ESPN hidden public API  (no key, no limit)
 *  2. football-data.org       (free tier: 10 req/min, key in env)
 *  3. OpenLigaDB              (free, German league + others)
 *
 * Data is normalised into a common shape and upserted into SQLite.
 */

const axios = require('axios');
const db = require('./db');

// ─── ESPN Public API (completely free, no key) ────────────
const ESPN_LEAGUES = [
  { id: 'fifa.world',       name: 'FIFA World Cup' }
];

async function fetchESPN() {
  const results = [];
  const now = new Date();
  
  const fmt = (d) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const start = new Date(now); start.setUTCDate(start.getUTCDate() - 1);
  const end   = new Date(now); end.setUTCDate(end.getUTCDate() + 7);
  const datesParam = `?dates=${fmt(start)}-${fmt(end)}`;

  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard${datesParam}`;
      const { data } = await axios.get(url, { timeout: 8000 });
      const events = data?.events || [];

      for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp) continue;

        const home = comp.competitors?.find(c => c.homeAway === 'home');
        const away = comp.competitors?.find(c => c.homeAway === 'away');
        if (!home || !away) continue;

        const statusType = comp.status?.type?.name || 'STATUS_SCHEDULED';
        const detail = comp.status?.type?.detail || '';

        let status = 'SCHEDULED';
        if (statusType === 'STATUS_IN_PROGRESS' || statusType.includes('HALF') || statusType.includes('HALFTIME') || statusType.includes('PROGRESS')) status = 'LIVE';
        else if (statusType === 'STATUS_FULL_TIME' || statusType === 'STATUS_FINAL') status = 'FINISHED';
        else if (statusType === 'STATUS_POSTPONED' || statusType === 'STATUS_CANCELED') status = 'POSTPONED';

        // Check if kickoff is within 5 minutes (or has passed) and match is scheduled/in progress on ESPN
        const kickoffMs = new Date(event.date).getTime();
        const nowMs = Date.now();
        if (status === 'SCHEDULED' && kickoffMs - nowMs <= 5 * 60 * 1000) {
          status = 'LIVE';
        }

        results.push({
          id: `espn_${event.id}`,
          home_team: home.team.displayName,
          away_team: away.team.displayName,
          home_score: status !== 'SCHEDULED' ? parseInt(home.score || 0) : null,
          away_score: status !== 'SCHEDULED' ? parseInt(away.score || 0) : null,
          status,
          kickoff_utc: event.date,
          competition: league.name,
          minute: detail.includes("'") ? detail : null,
          source: 'espn',
          raw: { statusType, detail },
        });
      }
    } catch (err) {
      console.error(`[ESPN] Failed ${league.id}:`, err.message);
    }
  }
  return results;
}

// ─── football-data.org (free tier, needs API key) ─────────
// Sign up free at https://www.football-data.org/
// Set FOOTBALL_DATA_KEY in Railway environment variables
const FD_KEY = process.env.FOOTBALL_DATA_KEY;
// football-data.org competition codes
// Free tier covers: WC, EC, CL, PL, PD, BL1, SA, FL1, DED, BSA, PPL, ELC, WCQ (some)
const FD_COMPETITIONS = [
  'WC',   // FIFA World Cup
];

async function fetchFootballData() {
  if (!FD_KEY) return []; // gracefully skip if no key
  const results = [];

  try {
    const { data } = await axios.get('https://api.football-data.org/v4/matches', {
      headers: { 'X-Auth-Token': FD_KEY },
      params: {
        competitions: FD_COMPETITIONS.join(','),
        dateFrom: todayISO(),
        dateTo: futureISO(3),
      },
      timeout: 10000,
    });

    for (const m of data.matches || []) {
      let status = mapFDStatus(m.status);
      const kickoffMs = new Date(m.utcDate).getTime();
      const nowMs = Date.now();
      if (status === 'SCHEDULED' && kickoffMs - nowMs <= 5 * 60 * 1000) {
        status = 'LIVE';
      }
      results.push({
        id: `fd_${m.id}`,
        home_team: m.homeTeam.name,
        away_team: m.awayTeam.name,
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        status,
        kickoff_utc: m.utcDate,
        competition: m.competition?.name || '',
        minute: null,
        source: 'football-data',
        raw: m,
      });
    }
  } catch (err) {
    console.error('[FD] Fetch error:', err.message);
  }
  return results;
}

function mapFDStatus(s) {
  if (s === 'SCHEDULED' || s === 'TIMED') return 'SCHEDULED';
  if (s === 'IN_PLAY' || s === 'PAUSED') return 'LIVE';
  if (s === 'FINISHED') return 'FINISHED';
  if (s === 'POSTPONED' || s === 'CANCELLED' || s === 'SUSPENDED') return 'POSTPONED';
  return 'SCHEDULED';
}

// ─── OpenLigaDB (totally free, German + other leagues) ────
// https://api.openligadb.de
async function fetchOpenLiga() {
  return []; // Disabled for FIFA World Cup focus
}

// ─── Main orchestrator ────────────────────────────────────
async function fetchAndStoreMatches() {
  try {
    const [espnMatches, fdMatches, olMatches] = await Promise.all([
      fetchESPN(),
      fetchFootballData(),
      fetchOpenLiga(),
    ]);

    const all = [...espnMatches, ...fdMatches, ...olMatches];
    let saved = 0;
    for (const m of all) {
      try {
        db.upsertMatch(m);
        saved++;
      } catch (e) {
        console.error('[DB] upsert error:', e.message);
      }
    }
    console.log(`[FETCH] Saved ${saved} matches (ESPN:${espnMatches.length} [incl. FIFA/WC/CL/Nations] FD:${fdMatches.length} OL:${olMatches.length})`);
    return all;
  } catch (err) {
    console.error('[FETCH] Fatal:', err.message);
    return [];
  }
}

// ─── Date helpers ─────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function futureISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { fetchAndStoreMatches };
