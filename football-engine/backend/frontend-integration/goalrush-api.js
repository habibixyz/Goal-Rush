/**
 * goalrush-api.js
 * Drop this into your GoalRush frontend (src/lib/goalrush-api.js)
 * and import wherever you need live match data.
 *
 * Usage:
 *   import { getLiveMatches, getUpcomingMatches, pollLive } from './goalrush-api';
 */

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://YOUR-RAILWAY-URL.railway.app';

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}/api${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Match data ───────────────────────────────────────────
export async function getLiveMatches() {
  const { data } = await apiFetch('/matches/live');
  return data;
}

export async function getUpcomingMatches(hours = 48) {
  const { data } = await apiFetch(`/matches/upcoming?hours=${hours}`);
  return data;
}

export async function getAllMatches(limit = 50) {
  const { data } = await apiFetch(`/matches/all?limit=${limit}`);
  return data;
}

export async function getMatch(id) {
  const { data } = await apiFetch(`/matches/${id}`);
  return data;
}

// ─── Predictions ──────────────────────────────────────────
export async function getMyPredictions(wallet) {
  const { data } = await apiFetch(`/predictions/${wallet}`);
  return data;
}

export async function savePrediction({ match_id, wallet, prediction, amount, tx_hash }) {
  const res = await fetch(`${BASE_URL}/api/predictions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ match_id, wallet, prediction, amount, tx_hash }),
  });
  return res.json();
}

// ─── Real-time polling (replaces WebSockets for simplicity) ──
/**
 * pollLive(callback, intervalMs)
 * Polls live matches every intervalMs milliseconds.
 * Returns a stop() function.
 *
 * Example:
 *   const stop = pollLive((matches) => setLiveMatches(matches), 15000);
 *   // later: stop();
 */
export function pollLive(callback, intervalMs = 15000) {
  let active = true;

  async function tick() {
    if (!active) return;
    try {
      const matches = await getLiveMatches();
      callback(matches);
    } catch (e) {
      console.error('[GoalRush] Poll error:', e.message);
    }
    if (active) setTimeout(tick, intervalMs);
  }

  tick();
  return () => { active = false; };
}

// ─── React hook (optional) ────────────────────────────────
// import { useState, useEffect } from 'react';
//
// export function useLiveMatches(intervalMs = 15000) {
//   const [matches, setMatches] = useState([]);
//   const [loading, setLoading] = useState(true);
//   useEffect(() => {
//     setLoading(true);
//     const stop = pollLive((m) => { setMatches(m); setLoading(false); }, intervalMs);
//     return stop;
//   }, [intervalMs]);
//   return { matches, loading };
// }
