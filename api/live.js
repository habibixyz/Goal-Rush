import https from 'https';

let cache = {
  data: null,
  timestamp: 0
};

function getTeamFifaCode(name) {
  const map = {
    'Argentina': 'ARG',
    'France': 'FRA',
    'Netherlands': 'NED',
    'Japan': 'JPN',
    'Ivory Coast': 'CIV',
    'Ecuador': 'ECU',
    'Sweden': 'SWE',
    'Tunisia': 'TUN',
    'Algeria': 'ALG'
  };
  return map[name] || 'UN';
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
        const matchDate = new Date(match.startTime);
        minuteDisplay = matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        minuteDisplay = 'Upcoming';
      }
    }

    let dateDisplay = 'Today';
    try {
      const matchDate = new Date(match.startTime);
      dateDisplay = matchDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (e) {}

    return {
      id: match.sofaId || match.id,
      dbId: match.id,
      teamA: match.homeTeam.name,
      flagA: match.homeTeam.logo || getTeamFifaCode(match.homeTeam.name),
      teamB: match.awayTeam.name,
      flagB: match.awayTeam.logo || getTeamFifaCode(match.awayTeam.name),
      scoreA: match.scoreHome,
      scoreB: match.scoreAway,
      minute: minuteDisplay,
      isLive: isLive,
      date: dateDisplay,
      startTime: match.startTime,
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
      path: '/api/live',
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
  // Add CORS headers so the local app can call it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Try database/backend first
  try {
    const backendData = await fetchFromBackend();
    if (Array.isArray(backendData) && backendData.length > 0) {
      // Prioritize international matches
      const internationalTeams = ['Belgium', 'Egypt', 'Saudi Arabia', 'Uruguay', 'Iran', 'New Zealand', 'Spain', 'Cape Verde', 'France', 'Argentina', 'Netherlands', 'Japan'];
      backendData.sort((a, b) => {
        const aIsIntl = internationalTeams.includes(a.homeTeam.name) || internationalTeams.includes(a.awayTeam.name);
        const bIsIntl = internationalTeams.includes(b.homeTeam.name) || internationalTeams.includes(b.awayTeam.name);
        if (aIsIntl && !bIsIntl) return -1;
        if (!aIsIntl && bIsIntl) return 1;
        return 0;
      });
      const mapped = mapDatabaseMatches(backendData);
      res.setHeader('X-Cache', 'BACKEND-LIVE');
      return res.status(200).json(mapped);
    }
  } catch (err) {
    console.warn('Failed to fetch live matches from backend, falling back to API Sports:', err.message);
  }

  const now = Date.now();
  // Cache for 5 minutes (300,000 ms) to be very safe with the 100 requests/day limit
  if (cache.data && (now - cache.timestamp < 300000)) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  // Determine today's date in YYYY-MM-DD format (UTC)
  const today = new Date().toISOString().split('T')[0];

  try {
    const rawData = await fetchFromApiSports(today);
    
    if (!rawData.response || rawData.response.length === 0) {
      // If today's response is empty, fetch all active live matches instead
      const liveData = await fetchLiveFromApiSports();
      const mapped = mapFixtures(liveData.response || []);
      cache.data = mapped;
      cache.timestamp = now;
      res.setHeader('X-Cache', 'MISS-LIVE');
      return res.status(200).json(mapped);
    }

    const mapped = mapFixtures(rawData.response);
    cache.data = mapped;
    cache.timestamp = now;
    res.setHeader('X-Cache', 'MISS-DATE');
    return res.status(200).json(mapped);
  } catch (error) {
    console.error('Error fetching from API Sports:', error);
    // If external call fails but we have cached data (even stale), return it
    if (cache.data) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache.data);
    }
    return res.status(500).json({ error: 'Failed to fetch football data', details: error.message });
  }
}

function fetchFromApiSports(date) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      path: `/fixtures?date=${date}`,
      method: 'GET',
      headers: {
        'x-apisports-key': 'd2864e54e9b7819ef45e280824f783cb'
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
        'x-apisports-key': 'd2864e54e9b7819ef45e280824f783cb'
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
  // Popular leagues to filter (World Cup, Champions League, Premier League, La Liga, Serie A, Euro, Copa America, etc.)
  const majorLeagueIds = [1, 2, 3, 4, 9, 39, 61, 78, 135, 140];
  
  // Sort: major leagues first, then others
  const sorted = [...fixtures].sort((a, b) => {
    const aIsMajor = majorLeagueIds.includes(a.league.id) ? 1 : 0;
    const bIsMajor = majorLeagueIds.includes(b.league.id) ? 1 : 0;
    return bIsMajor - aIsMajor;
  });

  // Take top 25 matches of the day to keep it clean and performant
  return sorted.slice(0, 25).map(item => {
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
