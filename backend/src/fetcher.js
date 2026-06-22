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
const { CheerioCrawler } = require('crawlee');
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

// ─── ESPN Soccer RSS News Fetcher ─────────────────────────
async function fetchWorldCupNews() {
  try {
    const articlesFound = [];
    const initialUrls = ['https://www.skysports.com/football/news'];

    // Also fetch ESPN RSS news links
    try {
      const axios = require('axios');
      const cheerio = require('cheerio');
      const rssRes = await axios.get('https://www.espn.in/espn/rss/soccer/news', { timeout: 5000 });
      const $rss = cheerio.load(rssRes.data, { xmlMode: true });
      $rss('item').slice(0, 15).each((_, el) => {
        let link = $rss(el).find('link').text().trim();
        if (link) {
          if (link.startsWith('http://')) link = link.replace('http://', 'https://');
          if (link.startsWith('https://www.espn.com/') || link.startsWith('https://www.espn.in/')) {
            initialUrls.push(link);
          }
        }
      });
    } catch (rssErr) {
      console.error('[CRAWLER] Failed to fetch ESPN RSS:', rssErr.message);
    }

    const crawler = new CheerioCrawler({
      maxConcurrency: 3,
      maxRequestsPerCrawl: 25,
      requestHandlerTimeoutSecs: 10,

      async requestHandler({ $, request, enqueueLinks }) {
        const urlString = request.url;

        // SSRF protection & domain lock
        const allowedDomains = [
          'https://www.skysports.com/',
          'https://www.espn.com/',
          'https://www.espn.in/'
        ];
        const isAllowed = allowedDomains.some(d => urlString.startsWith(d));
        if (!isAllowed) {
          console.warn('[CRAWLER] Ignored non-whitelisted target URL:', urlString);
          return;
        }

        // If it is the Sky Sports index page, enqueue article links
        if (urlString === 'https://www.skysports.com/football/news') {
          await enqueueLinks({
            selector: 'a',
            baseUrl: 'https://www.skysports.com',
            globs: ['https://www.skysports.com/football/news/**'],
          });
          return;
        }

        // Parse article details depending on platform
        let titleText = '';
        let leadText = '';
        const paragraphs = [];

        if (urlString.includes('skysports.com')) {
          titleText = $('.sdc-article-header__title').text().trim() || $('.article__title').text().trim() || $('h1').first().text().trim();
          leadText = $('.sdc-article-header__sub-title').text().trim() || $('.article__sub-title').text().trim() || $('.article__body p').first().text().trim();
          
          $('.sdc-article-body p').each((_, el) => {
            const text = $(el).text().trim();
            if (text) paragraphs.push(text);
          });
        } else if (urlString.includes('espn.com') || urlString.includes('espn.in')) {
          titleText = $('.article-header h1').text().trim() || $('h1.article-header').text().trim() || $('h1').first().text().trim();
          leadText = $('.article-body p').first().text().trim() || $('.article-copy p').first().text().trim();
          
          $('.article-body p, .article-copy p').each((_, el) => {
            const text = $(el).text().trim();
            if (text) paragraphs.push(text);
          });
        }

        const contentText = paragraphs.join('\n\n') || leadText;
        if (!titleText || !leadText) return;

        // Clean & sanitize inputs (prevent XSS, remove Copy of prefixes)
        const sanitize = (str) => {
          return str
            .replace(/<[^>]*>/g, '') 
            .replace(/^(copy of\s*)+/i, '') 
            .trim();
        };

        const cleanTitle = sanitize(titleText);
        const cleanSummary = sanitize(leadText);
        const cleanContent = sanitize(contentText).slice(0, 2000); 

        // Determine category (Match Report vs Team News)
        const category = (cleanTitle.toLowerCase().includes('report') || cleanTitle.toLowerCase().includes('draw') || cleanTitle.toLowerCase().includes('vs') || cleanTitle.toLowerCase().includes('beat') || cleanTitle.toLowerCase().includes('win'))
          ? 'Match Report'
          : 'Team News';

        const scrapedImg = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '';
        const imageUrl = (scrapedImg.startsWith('https://') && !scrapedImg.includes('<script'))
          ? scrapedImg
          : '/news-brand-logo.png';

        const source = urlString.includes('espn.com') || urlString.includes('espn.in') ? 'ESPN Soccer' : 'Sky Sports';

        articlesFound.push({
          title: cleanTitle,
          summary: cleanSummary,
          content: cleanContent,
          category,
          image_url: imageUrl,
          source,
          url: urlString,
          published_at: new Date().toISOString()
        });
      },

      failedRequestHandler({ request, error }) {
        console.error(`[CRAWLER] Request failed for ${request.url}:`, error.message);
      }
    });

    console.log('[CRAWLER] Starting news crawler for Sky Sports & ESPN.in...');
    await crawler.run(initialUrls);
    
    let added = 0;
    for (const art of articlesFound) {
      try {
        db.saveNewsArticle(art);
        added++;
      } catch (e) {
        // Safe to ignore duplicate titles due to UNIQUE constraint
      }
    }
    console.log(`[NEWS SCRAPE] Crawlee completed. Saved ${added} new football articles.`);
  } catch (err) {
    console.error('[NEWS SCRAPE] Crawlee fatal error:', err.message);
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

module.exports = {
  fetchAndStoreMatches,
  fetchWorldCupNews
};
