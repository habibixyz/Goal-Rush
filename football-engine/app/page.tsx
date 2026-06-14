'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { Tv, Flame, Timer, ShieldAlert } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Match {
  id: string;
  sofaId: number;
  homeTeam: Team;
  awayTeam: Team;
  scoreHome: number;
  scoreAway: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  minute: number;
  startTime: string;
}

interface EventLog {
  matchId: string;
  teamName: string;
  type: string;
  minute: number;
  player: string;
  detail?: string;
}

export default function LiveScoresPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventLog[]>([]);

  // Fetch initial matches list
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch('/api/live');
        if (!res.ok) throw new Error('Failed to fetch live matches');
        const data = await res.json();
        setMatches(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  // Connect to WebSocket Server for Realtime Updates
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket = io(socketUrl, { reconnectionDelayMax: 10000 });

    socket.on('connect', () => {
      console.log('Connected to Goal Rush WebSocket Server');
    });

    // Auto-subscribe to all loaded matches
    matches.forEach((m) => {
      socket.emit('join_match', m.id);
    });

    // Listen for realtime match events
    socket.on('match_event', (data: any) => {
      console.log('Received socket event:', data);
      const { type, match, event } = data;

      if (type === 'match_updated' && match) {
        setMatches((prev) =>
          prev.map((m) => (m.id === match.id ? { ...m, ...match } : m))
        );
      }

      if (type === 'new_event' && event) {
        const matchInfo = matches.find((m) => m.id === data.matchId);
        const eventLog: EventLog = {
          matchId: data.matchId,
          teamName: matchInfo ? matchInfo.homeTeam.name : 'Team',
          type: event.type,
          minute: event.minute,
          player: event.player,
          detail: event.detail
        };
        setRecentEvents((prev) => [eventLog, ...prev.slice(0, 9)]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [matches]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium animate-pulse">Analyzing Live Match feeds...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-xl mx-auto mt-12 text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Failed to Synchronize Feed</h3>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Matches Section */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Match Center</h1>
            <p className="text-gray-400 text-sm">Real-time goals, cards, and AI tactical shifts</p>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-12 text-center">
            <Tv className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">No Live Matches</h3>
            <p className="text-gray-500 text-sm">There are no matches currently playing or scheduled today.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {matches.map((match) => (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                className="block bg-gray-900/60 border border-gray-800/80 hover:border-emerald-500/30 rounded-2xl p-6 transition duration-300 transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/5 group"
              >
                <div className="flex items-center justify-between mb-4">
                  {match.status === 'LIVE' ? (
                    <div className="flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      Live • {match.minute}'
                    </div>
                  ) : match.status === 'FINISHED' ? (
                    <div className="bg-gray-800 text-gray-400 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Full Time
                    </div>
                  ) : (
                    <div className="bg-gray-900 border border-gray-800 text-gray-500 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-emerald-400 font-semibold text-xs bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition">
                    <Flame className="h-3 w-3" /> AI Insights Active
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center justify-center text-center">
                  <div className="text-right pr-4">
                    <span className="block text-white font-bold text-lg group-hover:text-emerald-400 transition">{match.homeTeam.name}</span>
                    <span className="text-xs text-gray-400 tracking-wider font-semibold uppercase">{match.homeTeam.shortName || 'HOME'}</span>
                  </div>

                  <div className="flex items-center justify-center gap-4 py-2 bg-gray-950/40 rounded-xl border border-gray-800/40 max-w-[140px] mx-auto w-full">
                    <span className="text-2xl font-black text-white">{match.scoreHome}</span>
                    <span className="text-gray-600 font-bold">:</span>
                    <span className="text-2xl font-black text-white">{match.scoreAway}</span>
                  </div>

                  <div className="text-left pl-4">
                    <span className="block text-white font-bold text-lg group-hover:text-emerald-400 transition">{match.awayTeam.name}</span>
                    <span className="text-xs text-gray-400 tracking-wider font-semibold uppercase">{match.awayTeam.shortName || 'AWAY'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Real-time Incident Feed */}
      <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            <Timer className="h-5 w-5 text-emerald-400" />
            Live Incident Feed
          </h2>
          <p className="text-gray-400 text-xs mt-1">Real-time game developments updated via WebSocket</p>
        </div>

        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
          {recentEvents.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Waiting for live match incidents...
            </div>
          ) : (
            recentEvents.map((evt, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 border-l-2 border-emerald-500 bg-gray-900/50 p-3.5 rounded-r-xl border border-gray-800/40 animate-fade-in"
              >
                <div className="flex-grow space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">{evt.type}</span>
                    <span className="text-xs text-gray-500">{evt.minute}'</span>
                  </div>
                  <p className="text-sm font-bold text-white">{evt.player}</p>
                  {evt.detail && <p className="text-xs text-gray-400">{evt.detail}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
