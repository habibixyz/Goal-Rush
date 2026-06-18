import https from 'https';

const API_SPORTS_KEY = process.env.APISPORTS_KEY;

let cache = {
  data: null,
  timestamp: 0
};

function getTeamFifaCode(name) {
  const map = {
    'argentina': 'ARG',
    'france': 'FRA',
    'netherlands': 'NED',
    'japan': 'JPN',
    'ivory coast': 'CIV',
    'ecuador': 'ECU',
    'sweden': 'SWE',
    'tunisia': 'TUN',
    'algeria': 'ALG',
    'spain': 'ESP',
    'cape verde': 'CPV',
    'iran': 'IRN',
    'new zealand': 'NZL',
    'saudi arabia': 'KSA',
    'uruguay': 'URU',
    'belgium': 'BEL',
    'egypt': 'EGY',
    'senegal': 'SEN'
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
          minuteDisplay = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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
        dateDisplay = matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      scorersB: []
    };
  });
}

function fetchFromBackend() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'goal-rush-backend-production.up.railway.app',
      path: '/api/matches/live',
      method: 'GET',
      timeout: 3000
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
      // Filter to only FIFA World Cup matches
      const worldCupBackendData = backendData.filter(m => 
        !m.competition || 
        m.competition.toLowerCase().includes('world cup') || 
        m.competition.toLowerCase().includes('fifa')
      );
      const internationalTeams = ['Belgium', 'Egypt', 'Saudi Arabia', 'Uruguay', 'Iran', 'New Zealand', 'Spain', 'Cape Verde', 'France', 'Argentina', 'Netherlands', 'Japan', 'Senegal'];
      worldCupBackendData.sort((a, b) => {
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
      allMatches = mapDatabaseMatches(worldCupBackendData);
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
    d2.setDate(d2.getDate() + 2); // Next 2 days
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
  // Filter for World Cup matches only (League ID 1 or name containing 'world cup')
  const worldCupFixtures = fixtures.filter(item => 
    item.league.id === 1 || 
    (item.league.name && item.league.name.toLowerCase().includes('world cup'))
  );

  // Take top 25 matches of the day to keep it clean and performant
  return worldCupFixtures.slice(0, 25).map(item => {
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
        minuteDisplay = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        minuteDisplay = 'Upcoming';
      }
    }

    let dateDisplay = 'Today';
    try {
      const matchDate = new Date(item.fixture.date);
      dateDisplay = matchDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
      scorersB: []
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
    } else if (statusType === 'STATUS_FULL_TIME' || statusType === 'STATUS_FINAL') {
      status = 'FINISHED';
    } else if (statusType === 'STATUS_POSTPONED' || statusType === 'STATUS_CANCELED') {
      status = 'POSTPONED';
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
          minuteDisplay = matchDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      } catch (e) {}
    }

    let dateDisplay = 'Today';
    try {
      const matchDate = new Date(event.date);
      if (!isNaN(matchDate.getTime())) {
        dateDisplay = matchDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      scorersB: []
    };
  }).filter(Boolean);
}

function fetchFromESPN(startDate, endDate) {
  return new Promise((resolve, reject) => {
    let path = '/apis/site/v2/sports/soccer/fifa.world/scoreboard';
    if (startDate && endDate) {
      path += `?dates=${startDate}-${endDate}`;
    }
    const options = {
      hostname: 'site.api.espn.com',
      path: path,
      method: 'GET',
      timeout: 5000
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('ESPN timeout'));
    });
    req.end();
  });
}
