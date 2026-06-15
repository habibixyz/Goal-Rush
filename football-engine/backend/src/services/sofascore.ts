import fetch from 'node-fetch';

export interface SofaMatch {
  id: number;
  homeTeam: { id: number; name: string; shortName?: string; logo?: string };
  awayTeam: { id: number; name: string; shortName?: string; logo?: string };
  status: 'scheduled' | 'live' | 'finished';
  homeScore: number;
  awayScore: number;
  minute?: number;
  startTime: string;
}

export interface SofaEvent {
  id: number;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR';
  minute: number;
  detail?: string;
  playerName: string;
  subPlayerName?: string;
}

export interface SofaLineup {
  home: { player: { id: number; name: string; position: string; number: number } }[];
  away: { player: { id: number; name: string; position: string; number: number } }[];
}

export interface SofaStanding {
  teamId: number;
  name: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

const espnCache = new Map<number, SofaEvent[]>();

export const getLiveMatches = async (): Promise<SofaMatch[]> => {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json() as any;
    
    if (!data.events || !Array.isArray(data.events)) return [];

    return data.events.map((event: any) => {
      const comp = event.competitions[0];
      const home = comp.competitors.find((c: any) => c.homeAway === 'home');
      const away = comp.competitors.find((c: any) => c.homeAway === 'away');
      
      const statusState = event.status.type.state; // 'pre', 'in', 'post'
      let mappedStatus: 'scheduled' | 'live' | 'finished' = 'scheduled';
      if (statusState === 'in') mappedStatus = 'live';
      else if (statusState === 'post') mappedStatus = 'finished';

      let minute = 0;
      if (event.status.displayClock) {
        const minMatch = event.status.displayClock.match(/(\d+)/);
        if (minMatch) minute = parseInt(minMatch[1], 10);
      }

      // Cache events for getMatchEvents
      const mappedEvents: SofaEvent[] = (comp.details || []).map((d: any, index: number) => {
        let type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR' = 'GOAL';
        const typeText = d.type.text || '';
        
        if (typeText.includes('Yellow Card')) type = 'YELLOW_CARD';
        else if (typeText.includes('Red Card')) type = 'RED_CARD';
        else if (typeText.includes('Penalty')) type = 'GOAL';

        let eMinute = 0;
        if (d.clock && d.clock.displayValue) {
          const eMinMatch = d.clock.displayValue.match(/(\d+)/);
          if (eMinMatch) eMinute = parseInt(eMinMatch[1], 10);
        }
        
        return {
          id: parseInt(event.id.slice(-6) + index.toString().padStart(2, '0'), 10),
          type,
          minute: eMinute,
          playerName: d.athletesInvolved && d.athletesInvolved.length > 0 ? d.athletesInvolved[0].displayName : 'Unknown',
          detail: typeText
        };
      });
      
      espnCache.set(parseInt(event.id, 10), mappedEvents);

      return {
        id: parseInt(event.id, 10),
        homeTeam: { 
          id: parseInt(home.team.id, 10), 
          name: home.team.name, 
          shortName: home.team.abbreviation, 
          logo: home.team.logo 
        },
        awayTeam: { 
          id: parseInt(away.team.id, 10), 
          name: away.team.name, 
          shortName: away.team.abbreviation, 
          logo: away.team.logo 
        },
        status: mappedStatus,
        homeScore: parseInt(home.score || '0', 10),
        awayScore: parseInt(away.score || '0', 10),
        minute,
        startTime: event.date
      };
    });
  } catch (err) {
    console.error('Failed to fetch live matches from ESPN:', err);
    return [];
  }
};

export const getMatchEvents = async (matchId: number): Promise<SofaEvent[]> => {
  return espnCache.get(matchId) || [];
};

export const getMatchLineups = async (matchId: number): Promise<SofaLineup> => {
  return { home: [], away: [] }; // ESPN Scoreboard does not provide lineups
};

export const getStandings = async (): Promise<SofaStanding[]> => {
  return []; // ESPN Scoreboard does not provide standings
};
