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
  // ── Club Leagues ──────────────────────────────────────
  { id: 'eng.1',            name: 'Premier League' },
  { id: 'eng.2',            name: 'Championship' },
  { id: 'esp.1',            name: 'La Liga' },
  { id: 'ger.1',            name: 'Bundesliga' },
  { id: 'ita.1',            name: 'Serie A' },
  { id: 'fra.1',            name: 'Ligue 1' },
  { id: 'ned.1',            name: 'Eredivisie' },
  { id: 'por.1',            name: 'Primeira Liga' },
  { id: 'tur.1',            name: 'Süper Lig' },
  { id: 'usa.1',            name: 'MLS' },
  { id: 'bra.1',            name: 'Brasileirão' },
  { id: 'arg.1',            name: 'Liga Profesional (Argentina)' },
  { id: 'mex.1',            name: 'Liga MX' },
  { id: 'ind.1',            name: 'Indian Super League' },
  { id: 'sau.1',            name: 'Saudi Pro League' },
  { id: 'jpn.1',            name: 'J1 League' },
  { id: 'aus.1',            name: 'A-League' },

  // ── UEFA Club Competitions ─────────────────────────────
  { id: 'uefa.champions',   name: 'UEFA Champions League' },
  { id: 'uefa.europa',      name: 'UEFA Europa League' },
  { id: 'uefa.europa.conf', name: 'UEFA Conference League' },

  // ── FIFA World Cup & Qualifiers ───────────────────────
  { id: 'fifa.world',       name: 'FIFA World Cup' },
  { id: 'fifa.worldq.afc',  name: 'World Cup Qualifying – AFC (Asia)' },
  { id: 'fifa.worldq.caf',  name: 'World Cup Qualifying – CAF (Africa)' },
  { id: 'fifa.worldq.conmebol', name: 'World Cup Qualifying – CONMEBOL (S. America)' },
  { id: 'fifa.worldq.concacaf', name: 'World Cup Qualifying – CONCACAF (N. America)' },
  { id: 'fifa.worldq.uefa', name: 'World Cup Qualifying – UEFA (Europe)' },
  { id: 'fifa.worldq.ofc',  name: 'World Cup Qualifying – OFC (Oceania)' },

  // ── FIFA Club World Cup ───────────────────────────────
  { id: 'fifa.cwc',         name: 'FIFA Club World Cup' },

  // ── Continental National Team Tournaments ─────────────
  { id: 'uefa.nations',     name: 'UEFA Nations League' },
  { id: 'uefa.euro',        name: 'UEFA European Championship' },
  { id: 'conmebol.america', name: 'Copa América' },
  { id: 'concacaf.gold',    name: 'CONCACAF Gold Cup' },
  { id: 'concacaf.nations', name: 'CONCACAF Nations League' },
  { id: 'caf.nations',      name: 'Africa Cup of Nations (AFCON)' },
  { id: 'afc.asian.cup',    name: 'AFC Asian Cup' },
  { id: 'afc.nations',      name: 'AFC Nations League' },
  { id: 'ofc.nations',      name: 'OFC Nations Cup' },

  // ── FIFA Friendlies / Other ───────────────────────────
  { id: 'fifa.friendly',    name: 'International Friendlies' },
  { id: 'fifa.olymp',       name: 'Olympic Football' },
  { id: 'fifa.u20.world',   name: 'FIFA U-20 World Cup' },
  { id: 'fifa.u17.world',   name: 'FIFA U-17 World Cup' },
  { id: 'fifa.wwc',         name: 'FIFA Women\'s World Cup' },
];

async function fetchESPN() {
  const results = [];
  for (const league of ESPN_LEAGUES) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.id}/scoreboard`;
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
        if (statusType === 'STATUS_IN_PROGRESS') status = 'LIVE';
        else if (statusType === 'STATUS_FULL_TIME' || statusType === 'STATUS_FINAL') status = 'FINISHED';
        else if (statusType === 'STATUS_POSTPONED' || statusType === 'STATUS_CANCELED') status = 'POSTPONED';

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
  'EC',   // UEFA European Championship
  'CL',   // UEFA Champions League
  'EL',   // UEFA Europa League
  'ECNL', // UEFA Nations League
  'PL',   // Premier League
  'PD',   // La Liga
  'BL1',  // Bundesliga
  'SA',   // Serie A
  'FL1',  // Ligue 1
  'DED',  // Eredivisie
  'PPL',  // Primeira Liga
  'BSA',  // Brasileirão
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
      const status = mapFDStatus(m.status);
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
  const results = [];
  const leagueSeason = [
    { league: 'bl1', season: '2024' },   // Bundesliga
    { league: 'bl2', season: '2024' },
  ];

  for (const { league, season } of leagueSeason) {
    try {
      const { data } = await axios.get(
        `https://api.openligadb.de/getmatchdata/${league}/${season}`,
        { timeout: 8000 }
      );
      const today = new Date();
      const window = 3 * 24 * 60 * 60 * 1000; // 3 days

      for (const m of data || []) {
        const kickoff = new Date(m.MatchDateTime);
        if (Math.abs(today - kickoff) > window) continue; // skip far-future/past

        let status = 'SCHEDULED';
        if (m.MatchIsFinished) status = 'FINISHED';
        else if (kickoff <= today) status = 'LIVE';

        results.push({
          id: `ol_${m.MatchID}`,
          home_team: m.Team1?.TeamName || '',
          away_team: m.Team2?.TeamName || '',
          home_score: m.MatchIsFinished ? (m.MatchResults?.[0]?.PointsTeam1 ?? null) : null,
          away_score: m.MatchIsFinished ? (m.MatchResults?.[0]?.PointsTeam2 ?? null) : null,
          status,
          kickoff_utc: m.MatchDateTimeUTC || m.MatchDateTime,
          competition: `OpenLiga ${league.toUpperCase()}`,
          minute: null,
          source: 'openligadb',
          raw: {},
        });
      }
    } catch (err) {
      console.error(`[OpenLiga] Failed ${league}:`, err.message);
    }
  }
  return results;
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
