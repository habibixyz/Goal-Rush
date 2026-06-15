/**
 * useLiveMatches.js — React hook
 * Auto-polls your Railway backend every 15s for live match updates.
 *
 * Usage in any component:
 *   import { useLiveMatches, useUpcomingMatches } from './useLiveMatches';
 *
 *   function ScoreBoard() {
 *     const { matches, loading, error } = useLiveMatches();
 *     if (loading) return <p>Loading...</p>;
 *     return matches.map(m => <MatchCard key={m.id} match={m} />);
 *   }
 */

import { useState, useEffect, useCallback } from 'react';

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://YOUR-RAILWAY-URL.railway.app';

async function get(path) {
  const r = await fetch(`${BASE}/api${path}`);
  const j = await r.json();
  return j.data;
}

// ─── Live matches hook ────────────────────────────────────
export function useLiveMatches(pollInterval = 15000) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const data = await get('/matches/live');
      setMatches(data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { matches, loading, error, refetch: fetch };
}

// ─── Upcoming matches hook ────────────────────────────────
export function useUpcomingMatches(hours = 48) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    get(`/matches/upcoming?hours=${hours}`)
      .then(d => { setMatches(d || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [hours]);

  return { matches, loading, error };
}

// ─── Single match poller ──────────────────────────────────
export function useMatch(matchId, pollInterval = 20000) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!matchId) return;
    try {
      const data = await get(`/matches/${matchId}`);
      setMatch(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetch();
    // Only poll if the match is live
    const id = setInterval(async () => {
      await fetch();
      if (match?.status === 'FINISHED') clearInterval(id);
    }, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { match, loading };
}
