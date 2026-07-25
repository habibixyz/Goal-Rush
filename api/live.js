import https from 'https';
import http from 'http';

const API_SPORTS_KEY = process.env.APISPORTS_KEY;

let cache = {
  data: null,
  timestamp: 0
};

function getTeamFifaCode(name) {
  const map = {
    'argentina': 'ARG',
    'france': 'FRA',
    'canada': 'CAN',
    'united states': 'USA',
    'mexico': 'MEX',
    'brazil': 'BRA',
    'spain': 'ESP',
    'germany': 'GER',
    'england': 'ENG',
    'italy': 'ITA',
    'portugal': 'POR',
    'croatia': 'CRO',
    'netherlands': 'NED',
    'belgium': 'BEL',
    'japan': 'JPN',
    'korea': 'KOR',
    'korea republic': 'KOR',
    'switzerland': 'SUI',
    'morocco': 'MAR',
    'qatar': 'QAT',
    'ecuador': 'ECU',
    'iran': 'IRN',
    'senegal': 'SEN',
    'wales': 'WAL',
    'saudi arabia': 'KSA',
    'denmark': 'DEN',
    'tunisia': 'TUN',
    'poland': 'POL',
    'australia': 'AUS',
    'costa rica': 'CRC',
    'cameroon': 'CMR',
    'uruguay': 'URU',
    'ghana': 'GHA',
    'serbia': 'SRB',
    'scotland': 'SCO',
    'bosnia & herzegovina': 'BIH',
    'paraguay': 'PAR',
    'south africa': 'RSA',
    'czechia': 'CZE',
    'haiti': 'HAI',
    'curacao': 'CUW',
    'new zealand': 'NZL',
    'egypt': 'EGY',
    'cape verde': 'CPV',
    'dr congo': 'COD',
    'jordan': 'JOR',
    'austria': 'AUT',
    'panama': 'PAN',
    'uzbekistan': 'UZB',
    'colombia': 'COL',
    'south korea': 'KOR',
    'slovakia': 'SVK',
    'turkey': 'TUR',
    'iraq': 'IRQ',
    'norway': 'NOR',
    'algeria': 'ALG',
    // EPL clubs (England)
    'arsenal': 'ENG', 'chelsea': 'ENG', 'liverpool': 'ENG', 'manchester city': 'ENG', 'man city': 'ENG',
    'manchester united': 'ENG', 'man united': 'ENG', 'tottenham hotspur': 'ENG', 'tottenham': 'ENG',
    'aston villa': 'ENG', 'newcastle': 'ENG', 'newcastle united': 'ENG', 'west ham': 'ENG', 'west ham united': 'ENG',
    'everton': 'ENG', 'leicester': 'ENG', 'leicester city': 'ENG', 'wolves': 'ENG', 'wolverhampton wanderers': 'ENG',
    'crystal palace': 'ENG', 'brighton': 'ENG', 'fulham': 'ENG', 'brentford': 'ENG', 'bournemouth': 'ENG',
    'nottingham forest': 'ENG', 'ipswich': 'ENG', 'ipswich town': 'ENG', 'southampton': 'ENG',
    // La Liga clubs (Spain)
    'real madrid': 'ESP', 'barcelona': 'ESP', 'fc barcelona': 'ESP', 'atletico madrid': 'ESP',
    'real sociedad': 'ESP', 'sevilla': 'ESP', 'real betis': 'ESP', 'athletic club': 'ESP', 'athletic bilbao': 'ESP',
    'girona': 'ESP', 'valencia': 'ESP', 'villarreal': 'ESP',
    // Bundesliga clubs (Germany)
    'bayern munich': 'GER', 'bayern münchen': 'GER', 'borussia dortmund': 'GER', 'dortmund': 'GER',
    'bayer leverkusen': 'GER', 'leverkusen': 'GER', 'rb leipzig': 'GER', 'leipzig': 'GER',
    'eintracht frankfurt': 'GER', 'stuttgart': 'GER', 'vfb stuttgart': 'GER',
    // Serie A clubs (Italy)
    'juventus': 'ITA', 'ac milan': 'ITA', 'milan': 'ITA', 'inter milan': 'ITA', 'inter': 'ITA', 'internazionale': 'ITA',
    'napoli': 'ITA', 'roma': 'ITA', 'as roma': 'ITA', 'lazio': 'ITA', 'atalanta': 'ITA', 'fiorentina': 'ITA',
    // Ligue 1 clubs (France)
    'paris saint-germain': 'FRA', 'psg': 'FRA', 'marseille': 'FRA', 'monaco': 'FRA', 'as monaco': 'FRA',
    'lyon': 'FRA', 'lille': 'FRA', 'lens': 'FRA',
    // MLS clubs (USA/Canada)
    'inter miami': 'USA', 'inter miami cf': 'USA', 'la galaxy': 'USA', 'lafc': 'USA', 'los angeles fc': 'USA',
    'new york red bulls': 'USA', 'nycfc': 'USA', 'new york city fc': 'USA', 'seattle sounders': 'USA',
    'toronto fc': 'CAN', 'vancouver whitecaps': 'CAN', 'cf montreal': 'CAN', 'sporting kansas city': 'USA',
    'chicago fire': 'USA', 'chicago fire fc': 'USA', 'st. louis city sc': 'USA', 'columbus crew': 'USA'
  };
  return map[name?.toLowerCase().trim()] || 'UN';
}

function mapDatabaseMatches(matches) {
  return matches.map(match => {
    const isLive = match.status === 'LIVE';
    const isCompleted = match.status === 'FINISHED';
    
    let minuteDisplay = 'Upcoming';
    if (isLive) {
      minuteDisplay = `${match.minute}'`;
    } else if (isCompleted) {
      minuteDisplay = 'FT';
    } else {
      try {
        const matchDate = new Date(match.kickoff_utc || match.start_time || match.startTime);
        if (!isNaN(matchDate.getTime())) {
          minuteDisplay = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
        } else {
          minuteDisplay = 'Upcoming';
        }
      } catch (e) {
        minuteDisplay = 'Upcoming';
      }
    }

    let dateDisplay = 'TBD';
    try {
      const matchDate = new Date(match.kickoff_utc || match.start_time || match.startTime);
      if (!isNaN(matchDate.getTime())) {
        dateDisplay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(matchDate);
      }
    } catch (e) {}

    const homeName = match.home_team || (match.homeTeam && match.homeTeam.name) || 'Unknown';
    const awayName = match.away_team || (match.awayTeam && match.awayTeam.name) || 'Unknown';

    return {
      id: match.sofaId || match.id,
      dbId: match.id,
      teamA: homeName,
      flagA: getTeamFifaCode(homeName),
      teamB: awayName,
      flagB: getTeamFifaCode(awayName),
      scoreA: match.home_score !== undefined ? match.home_score : match.scoreHome,
      scoreB: match.away_score !== undefined ? match.away_score : match.scoreAway,
      minute: minuteDisplay,
      isLive: isLive,
      date: dateDisplay,
      startTime: new Date(match.kickoff_utc || match.start_time || match.startTime || Date.now()).getTime(),
      stadium: 'Stadium',
      capacity: 'N/A',
      city: 'City',
      referee: 'Referee',
      scorersA: [],
      scorersB: [],
      competition: match.competition || 'FIFA World Cup'
    };
  });
}

function fetchFromBackend() {
  const isDev = process.env.NODE_ENV !== 'production' || !process.env.VERCEL;
  const hostname = isDev ? '127.0.0.1' : 'goal-rush-backend-production.up.railway.app';
  const port = isDev ? 3001 : undefined;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: hostname,
      port: port,
      path: '/api/matches/all',
      method: 'GET',
      timeout: 3000
    };

    const client = isDev ? http : https;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Backend timeout'));
    });
    req.end();
  });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sendJson = (data) => {
    res.status(200).json(data);
  };

  let allMatches = [];

  // 1. Fetch from database/backend to get ALL matches (including historical ones from yesterday)
  try {
    const responseBody = await fetchFromBackend();
    const backendData = responseBody.data ? responseBody.data : responseBody;
    if (Array.isArray(backendData) && backendData.length > 0) {
      const internationalTeams = ['Belgium', 'Egypt', 'Saudi Arabia', 'Uruguay', 'Iran', 'New Zealand', 'Spain', 'Cape Verde', 'France', 'Argentina', 'Netherlands', 'Japan', 'Senegal'];
      backendData.sort((a, b) => {
        const homeA = a.home_team || (a.homeTeam && a.homeTeam.name) || '';
        const awayA = a.away_team || (a.awayTeam && a.awayTeam.name) || '';
        const homeB = b.home_team || (b.homeTeam && b.homeTeam.name) || '';
        const awayB = b.away_team || (b.awayTeam && b.awayTeam.name) || '';

        const aIsIntl = internationalTeams.includes(homeA) || internationalTeams.includes(awayA);
        const bIsIntl = internationalTeams.includes(homeB) || internationalTeams.includes(awayB);
        if (aIsIntl && !bIsIntl) return -1;
        if (!aIsIntl && bIsIntl) return 1;
        return 0;
      });
      allMatches = mapDatabaseMatches(backendData);
    }
  } catch (err) {
    console.warn('Failed to fetch live matches from backend:', err.message);
  }

  // 2. Try ESPN API to get the freshest live matches today and upcoming matches
  try {
    const d1 = new Date();
    d1.setDate(d1.getDate() - 1); // Yesterday
    const startStr = d1.toISOString().split('T')[0].replace(/-/g, '');
    const d2 = new Date();
    d2.setDate(d2.getDate() + 7); // Next 7 days
    const endStr = d2.toISOString().split('T')[0].replace(/-/g, '');

    const espnData = await fetchFromESPN(startStr, endStr);
    if (espnData && espnData.events && espnData.events.length > 0) {
      const espnMapped = mapESPNFixtures(espnData.events);
      espnMapped.forEach(em => {
        const idx = allMatches.findIndex(m => m.id === em.id || (m.teamA === em.teamA && m.teamB === em.teamB));
        if (idx !== -1) {
          allMatches[idx] = em;
        } else {
          allMatches.push(em);
        }
      });
    }
  } catch (err) {
    console.warn('Failed to fetch from ESPN API:', err.message);
  }

  if (allMatches.length > 0) {
    // Enforce strict chronological sorting (LIVE first, then by start time)
    allMatches.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return a.startTime - b.startTime;
    });

    res.setHeader('X-Cache', 'MERGED-LIVE');
    return sendJson(allMatches);
  }

  const now = Date.now();
  // Cache for 5 minutes (300,000 ms) to be very safe with the 100 requests/day limit
  if (cache.data && (now - cache.timestamp < 300000)) {
    res.setHeader('X-Cache', 'HIT');
    return sendJson(cache.data);
  }

  // Determine today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().split('T')[0];

  try {
    if (!API_SPORTS_KEY) {
      throw new Error('API Sports is not configured');
    }
    const rawData = await fetchFromApiSports(today);
    
    if (!rawData.response || rawData.response.length === 0) {
      // If today's response is empty, fetch all active live matches instead
      const liveData = await fetchLiveFromApiSports();
      const mapped = mapFixtures(liveData.response || []);
      cache.data = mapped;
      cache.timestamp = now;
      res.setHeader('X-Cache', 'MISS-LIVE');
      return sendJson(mapped);
    }

    const mapped = mapFixtures(rawData.response);
    cache.data = mapped;
    cache.timestamp = now;
    res.setHeader('X-Cache', 'MISS-DATE');
    return sendJson(mapped);
  } catch (error) {
    console.error('Error fetching from API Sports:', error);
    // If external call fails but we have cached data (even stale), return it
    if (cache.data) {
      res.setHeader('X-Cache', 'STALE');
      return sendJson(cache.data);
    }
    return res.status(503).json({ error: 'Football data is temporarily unavailable' });
  }
}

function fetchFromApiSports(date) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      path: `/fixtures?date=${date}`,
      method: 'GET',
      headers: {
        'x-apisports-key': API_SPORTS_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function fetchLiveFromApiSports() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      path: '/fixtures?live=all',
      method: 'GET',
      headers: {
        'x-apisports-key': API_SPORTS_KEY
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function mapFixtures(fixtures) {
  // Keep World Cup and our other configured leagues
  const filteredFixtures = fixtures.filter(item => {
    const name = item.league.name?.toLowerCase() || '';
    return name.includes('world cup') || name.includes('premier league') || name.includes('champions league') || name.includes('la liga') || name.includes('bundesliga') || name.includes('serie a') || name.includes('major league soccer') || name.includes('mls');
  });

  // Take top 50 matches to support more league coverage
  return filteredFixtures.slice(0, 50).map(item => {
    const isLive = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'INT'].includes(item.fixture.status.short);
    const isCompleted = ['FT', 'AET', 'PEN'].includes(item.fixture.status.short);
    
    let minuteDisplay = 'Upcoming';
    if (isLive) {
      minuteDisplay = item.fixture.status.short === 'HT' ? 'HT' : `${item.fixture.status.elapsed}'`;
    } else if (isCompleted) {
      minuteDisplay = 'FT';
    } else if (item.fixture.status.short === 'NS') {
      try {
        const matchDate = new Date(item.fixture.date);
        minuteDisplay = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
      } catch (e) {
        minuteDisplay = 'Upcoming';
      }
    }

    let dateDisplay = 'Today';
    try {
      const matchDate = new Date(item.fixture.date);
      dateDisplay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(matchDate);
    } catch (e) {}

    return {
      id: `api-${item.fixture.id}`,
      teamA: item.teams.home.name,
      flagA: item.teams.home.logo || 'UN',
      teamB: item.teams.away.name,
      flagB: item.teams.away.logo || 'UN',
      scoreA: item.goals.home !== null ? item.goals.home : 0,
      scoreB: item.goals.away !== null ? item.goals.away : 0,
      minute: minuteDisplay,
      isLive: isLive,
      date: dateDisplay,
      stadium: item.fixture.venue.name || 'Stadium',
      capacity: 'N/A',
      city: item.fixture.venue.city || 'City',
      referee: item.fixture.referee || 'Referee',
      scorersA: [],
      scorersB: [],
      competition: item.league.name || 'FIFA World Cup'
    };
  });
}



function mapESPNFixtures(events) {
  return events.map(event => {
    const comp = event.competitions?.[0];
    if (!comp) return null;

    const home = comp.competitors?.find(c => c.homeAway === 'home');
    const away = comp.competitors?.find(c => c.homeAway === 'away');
    if (!home || !away) return null;

    const statusType = comp.status?.type?.name || 'STATUS_SCHEDULED';
    const detail = comp.status?.type?.detail || '';

    let status = 'SCHEDULED';
    if (statusType === 'STATUS_IN_PROGRESS' || statusType.includes('HALF') || statusType.includes('HALFTIME') || statusType.includes('PROGRESS')) {
      status = 'LIVE';
    } else if (statusType === 'STATUS_FULL_TIME' || statusType.startsWith('STATUS_FINAL') || statusType === 'STATUS_FT') {
      status = 'FINISHED';
    } else if (statusType === 'STATUS_POSTPONED' || statusType === 'STATUS_CANCELED') {
      status = 'POSTPONED';
    }

    // Check if kickoff is within 5 minutes (or has passed) and match is scheduled/in progress on ESPN
    const kickoffMs = new Date(event.date).getTime();
    const nowMs = Date.now();
    if (status === 'SCHEDULED' && kickoffMs - nowMs <= 5 * 60 * 1000) {
      status = 'LIVE';
    }

    const isLive = status === 'LIVE';
    const isCompleted = status === 'FINISHED';

    let minuteDisplay = 'Upcoming';
    if (isLive) {
      minuteDisplay = detail.includes("'") ? detail : 'Live';
    } else if (isCompleted) {
      minuteDisplay = 'FT';
    } else {
      try {
        const matchDate = new Date(event.date);
        if (!isNaN(matchDate.getTime())) {
          minuteDisplay = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' ET';
        }
      } catch (e) {}
    }

    let dateDisplay = 'Today';
    try {
      const matchDate = new Date(event.date);
      if (!isNaN(matchDate.getTime())) {
        dateDisplay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(matchDate);
      }
    } catch (e) {}

    const homeName = home.team.displayName;
    const awayName = away.team.displayName;

    return {
      id: `espn_${event.id}`,
      dbId: `espn_${event.id}`,
      teamA: homeName,
      flagA: getTeamFifaCode(homeName),
      teamB: awayName,
      flagB: getTeamFifaCode(awayName),
      scoreA: status !== 'SCHEDULED' ? parseInt(home.score || 0) : 0,
      scoreB: status !== 'SCHEDULED' ? parseInt(away.score || 0) : 0,
      minute: minuteDisplay,
      isLive: isLive,
      date: dateDisplay,
      startTime: new Date(event.date).getTime(),
      stadium: comp.venue?.fullName || 'Stadium',
      capacity: 'N/A',
      city: comp.venue?.address?.city || 'City',
      referee: 'Referee',
      scorersA: [],
      scorersB: [],
      competition: event.leagueName || 'FIFA World Cup'
    };
  }).filter(Boolean);
}

function fetchFromESPN(startDate, endDate) {
  const leagues = [
    { id: 'fifa.world',       name: 'FIFA World Cup' },
    { id: 'eng.1',            name: 'English Premier League' },
    { id: 'uefa.champions',   name: 'UEFA Champions League' },
    { id: 'esp.1',            name: 'Spanish La Liga' },
    { id: 'ger.1',            name: 'German Bundesliga' },
    { id: 'ita.1',            name: 'Italian Serie A' },
    { id: 'usa.1',            name: 'Major League Soccer' }
  ];

  return Promise.all(
    leagues.map(league => {
      return new Promise((resolve) => {
        let path = `/apis/site/v2/sports/soccer/${league.id}/scoreboard`;
        if (startDate && endDate) {
          path += `?dates=${startDate}-${endDate}`;
        }
        const options = {
          hostname: 'site.api.espn.com',
          path: path,
          method: 'GET',
          timeout: 4000
        };
        const req = https.request(options, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (parsed.events) {
                parsed.events.forEach(e => {
                  e.leagueName = league.name;
                });
                resolve(parsed.events);
              } else {
                resolve([]);
              }
            } catch (err) {
              resolve([]);
            }
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => {
          req.destroy();
          resolve([]);
        });
        req.end();
      });
    })
  ).then(results => {
    return { events: results.flat() };
  });
}
