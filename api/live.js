import https from 'https';

let cache = {
  data: null,
  timestamp: 0
};

export default async function handler(req, res) {
  // Add CORS headers so the local app can call it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
