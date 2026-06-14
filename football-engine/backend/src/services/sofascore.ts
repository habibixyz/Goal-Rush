import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const SOFASCORE_API_URL = process.env.SOFASCORE_API_URL || '';
const SOFASCORE_API_KEY = process.env.SOFASCORE_API_KEY || '';

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

// Simulated active match state
let simMinute = 1;
let simHomeScore = 0;
let simAwayScore = 0;
const simEvents: SofaEvent[] = [];

export const getLiveMatches = async (): Promise<SofaMatch[]> => {
  if (!SOFASCORE_API_URL) {
    const now = new Date();
    const startTime = new Date(now.getTime() - simMinute * 60000).toISOString();
    
    simMinute = simMinute >= 90 ? 1 : simMinute + 1;
    
    if (simMinute === 15 && simHomeScore === 0) {
      simHomeScore = 1;
      simEvents.push({
        id: 1001,
        type: 'GOAL',
        minute: 15,
        playerName: 'Lionel Messi',
        detail: 'Brilliant free kick into top corner'
      });
    }
    if (simMinute === 38 && simEvents.filter(e => e.id === 1002).length === 0) {
      simEvents.push({
        id: 1002,
        type: 'YELLOW_CARD',
        minute: 38,
        playerName: 'Antoine Griezmann',
        detail: 'Tactical foul'
      });
    }
    if (simMinute === 55 && simAwayScore === 0) {
      simAwayScore = 1;
      simEvents.push({
        id: 1003,
        type: 'GOAL',
        minute: 55,
        playerName: 'Kylian Mbappe',
        detail: 'Assisted by Griezmann'
      });
    }
    if (simMinute === 72 && simEvents.filter(e => e.id === 1004).length === 0) {
      simHomeScore = 2;
      simEvents.push({
        id: 1004,
        type: 'GOAL',
        minute: 72,
        playerName: 'Lautaro Martinez',
        detail: 'Tap-in after rebound'
      });
    }

    return [
      {
        id: 42,
        homeTeam: { id: 101, name: 'Argentina', shortName: 'ARG', logo: 'https://api.sofascore.app/teams/argentina.png' },
        awayTeam: { id: 102, name: 'France', shortName: 'FRA', logo: 'https://api.sofascore.app/teams/france.png' },
        status: simMinute >= 90 ? 'finished' : 'live',
        homeScore: simHomeScore,
        awayScore: simAwayScore,
        minute: simMinute,
        startTime: startTime
      }
    ];
  }

  try {
    const res = await fetch(`${SOFASCORE_API_URL}/matches/live`, {
      headers: SOFASCORE_API_KEY ? { 'X-Auth-Token': SOFASCORE_API_KEY } : {}
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json() as SofaMatch[];
  } catch (err) {
    console.error('Failed to fetch live matches from Sofascore:', err);
    return [];
  }
};

export const getMatchEvents = async (matchId: number): Promise<SofaEvent[]> => {
  if (!SOFASCORE_API_URL) {
    return simEvents.filter(e => e.minute <= simMinute);
  }

  try {
    const res = await fetch(`${SOFASCORE_API_URL}/matches/${matchId}/events`, {
      headers: SOFASCORE_API_KEY ? { 'X-Auth-Token': SOFASCORE_API_KEY } : {}
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json() as SofaEvent[];
  } catch (err) {
    console.error(`Failed to fetch events for match ${matchId}:`, err);
    return [];
  }
};

export const getMatchLineups = async (matchId: number): Promise<SofaLineup> => {
  if (!SOFASCORE_API_URL) {
    return {
      home: [
        { player: { id: 201, name: 'Lionel Messi', position: 'FW', number: 10 } },
        { player: { id: 202, name: 'Lautaro Martinez', position: 'FW', number: 22 } },
        { player: { id: 203, name: 'Enzo Fernandez', position: 'MF', number: 24 } },
        { player: { id: 204, name: 'Rodrigo De Paul', position: 'MF', number: 7 } },
        { player: { id: 205, name: 'Alexis Mac Allister', position: 'MF', number: 20 } },
        { player: { id: 206, name: 'Nahuel Molina', position: 'DF', number: 26 } },
        { player: { id: 207, name: 'Cristian Romero', position: 'DF', number: 13 } },
        { player: { id: 208, name: 'Nicolas Otamendi', position: 'DF', number: 19 } },
        { player: { id: 209, name: 'Nicolas Tagliafico', position: 'DF', number: 3 } },
        { player: { id: 210, name: 'Emiliano Martinez', position: 'GK', number: 23 } }
      ],
      away: [
        { player: { id: 301, name: 'Kylian Mbappe', position: 'FW', number: 10 } },
        { player: { id: 302, name: 'Olivier Giroud', position: 'FW', number: 9 } },
        { player: { id: 303, name: 'Antoine Griezmann', position: 'MF', number: 7 } },
        { player: { id: 304, name: 'Ousmane Dembele', position: 'FW', number: 11 } },
        { player: { id: 305, name: 'Adrien Rabiot', position: 'MF', number: 14 } },
        { player: { id: 306, name: 'Aurelien Tchouameni', position: 'MF', number: 8 } },
        { player: { id: 307, name: 'Theo Hernandez', position: 'DF', number: 22 } },
        { player: { id: 308, name: 'Dayot Upamecano', position: 'DF', number: 18 } },
        { player: { id: 309, name: 'Raphael Varane', position: 'DF', number: 4 } },
        { player: { id: 310, name: 'Jules Kounde', position: 'DF', number: 5 } },
        { player: { id: 311, name: 'Hugo Lloris', position: 'GK', number: 1 } }
      ]
    };
  }

  try {
    const res = await fetch(`${SOFASCORE_API_URL}/matches/${matchId}/lineups`, {
      headers: SOFASCORE_API_KEY ? { 'X-Auth-Token': SOFASCORE_API_KEY } : {}
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json() as SofaLineup;
  } catch (err) {
    console.error(`Failed to fetch lineups for match ${matchId}:`, err);
    return { home: [], away: [] };
  }
};

export const getStandings = async (): Promise<SofaStanding[]> => {
  if (!SOFASCORE_API_URL) {
    return [
      { teamId: 101, name: 'Argentina', points: 6, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 5, goalsAgainst: 2 },
      { teamId: 102, name: 'France', points: 6, played: 3, won: 2, drawn: 0, lost: 1, goalsFor: 6, goalsAgainst: 3 },
      { teamId: 103, name: 'Poland', points: 4, played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 2 },
      { teamId: 104, name: 'Mexico', points: 4, played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 2, goalsAgainst: 3 }
    ];
  }

  try {
    const res = await fetch(`${SOFASCORE_API_URL}/standings`, {
      headers: SOFASCORE_API_KEY ? { 'X-Auth-Token': SOFASCORE_API_KEY } : {}
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json() as SofaStanding[];
  } catch (err) {
    console.error('Failed to fetch standings:', err);
    return [];
  }
};
