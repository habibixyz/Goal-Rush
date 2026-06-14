'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io } from 'socket.io-client';
import { Sparkles, Users, MessageSquare, AlertCircle, Info } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  position: string;
  number: number;
}

interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  players: Player[];
}

interface MatchEvent {
  id: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'SUBSTITUTION' | 'VAR';
  minute: number;
  detail?: string;
  playerAId?: string;
}

interface Prediction {
  predictedWinner: string;
  confidence: number;
  winProbHome: number;
  winProbAway: number;
  winProbDraw: number;
  tacticalAnalysis: string;
  keyPlayerInsight: string;
  scorePrediction: string;
}

interface MatchDetails {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  scoreHome: number;
  scoreAway: number;
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
  minute: number;
  startTime: string;
  events: MatchEvent[];
  predictions: Prediction[];
}

export default function MatchDetailPage() {
  const { id } = useParams() as { id: string };
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial match details
  useEffect(() => {
    const fetchMatchDetails = async () => {
      try {
        const res = await fetch(`/api/match/${id}`);
        if (!res.ok) throw new Error('Match details not found');
        const data = await res.json();
        setMatch(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMatchDetails();
  }, [id]);

  // Connect to WebSocket Server for Realtime Updates
  useEffect(() => {
    if (!match) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
    const socket = io(socketUrl);

    socket.emit('join_match', match.id);

    socket.on('match_event', (data: any) => {
      const { type, match: updatedMatch, event } = data;
      console.log('WS update received on match page:', data);

      if (type === 'match_updated' && updatedMatch) {
        setMatch((prev) => (prev ? { ...prev, ...updatedMatch } : null));
      }

      if (type === 'new_event' && event) {
        setMatch((prev) => {
          if (!prev) return null;
          // Prevent duplicates in events array
          if (prev.events.some((e) => e.id === event.id)) return prev;
          return {
            ...prev,
            events: [...prev.events, event].sort((a, b) => a.minute - b.minute)
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [match]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4">
        <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium">Gathering match statistics...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-xl mx-auto mt-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Match Query Failed</h3>
        <p className="text-gray-400 text-sm">{error || 'Unable to retrieve match details.'}</p>
      </div>
    );
  }

  const latestPrediction = match.predictions?.[0];

  return (
    <div className="space-y-8">
      {/* Dynamic Scoreboard */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-950 border border-gray-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent"></div>
        
        <div className="relative flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Home Team */}
          <div className="flex flex-col items-center md:items-end gap-3 text-center md:text-right flex-1">
            <h2 className="text-2xl md:text-3xl font-black text-white">{match.homeTeam.name}</h2>
            <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Home</span>
          </div>

          {/* Scores & Minute */}
          <div className="flex flex-col items-center justify-center gap-3 min-w-[200px]">
            {match.status === 'LIVE' ? (
              <span className="flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/25 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
                Live • {match.minute}'
              </span>
            ) : match.status === 'FINISHED' ? (
              <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                Full Time
              </span>
            ) : (
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                {new Date(match.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <div className="flex items-center gap-6 bg-gray-950/80 px-8 py-3.5 rounded-2xl border border-gray-800/60 shadow-inner">
              <span className="text-4xl md:text-5xl font-black text-white">{match.scoreHome}</span>
              <span className="text-gray-700 font-black text-2xl">:</span>
              <span className="text-4xl md:text-5xl font-black text-white">{match.scoreAway}</span>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center md:items-start gap-3 text-center md:text-left flex-1">
            <h2 className="text-2xl md:text-3xl font-black text-white">{match.awayTeam.name}</h2>
            <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Away</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns (AI Insights & Lineups) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* AI Insights Card */}
          {latestPrediction ? (
            <div className="bg-gradient-to-br from-emerald-950/20 via-gray-900/40 to-gray-900/60 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <Sparkles className="h-6 w-6 text-emerald-400 animate-pulse" />
              </div>

              <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6">
                AI Intelligence & Predictions
              </h3>

              {/* Win Probability split */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between text-sm font-bold text-gray-300">
                  <span>Win Probabilities</span>
                  <span className="text-emerald-400">Winner Pick: {latestPrediction.predictedWinner}</span>
                </div>
                
                <div className="flex h-5 w-full bg-gray-950 rounded-full overflow-hidden border border-gray-800/40 p-0.5">
                  <div
                    style={{ width: `${latestPrediction.winProbHome}%` }}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-center text-[10px] font-black text-gray-950 transition-all duration-500"
                  >
                    {latestPrediction.winProbHome > 15 && `${latestPrediction.winProbHome}%`}
                  </div>
                  <div
                    style={{ width: `${latestPrediction.winProbDraw}%` }}
                    className="bg-gray-700 flex items-center justify-center text-[10px] font-black text-white transition-all duration-500"
                  >
                    {latestPrediction.winProbDraw > 15 && `${latestPrediction.winProbDraw}%`}
                  </div>
                  <div
                    style={{ width: `${latestPrediction.winProbAway}%` }}
                    className="bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-center text-[10px] font-black text-gray-950 transition-all duration-500"
                  >
                    {latestPrediction.winProbAway > 15 && `${latestPrediction.winProbAway}%`}
                  </div>
                </div>

                <div className="flex justify-between text-xs font-semibold text-gray-400 px-1">
                  <span>Home: {latestPrediction.winProbHome}%</span>
                  <span>Draw: {latestPrediction.winProbDraw}%</span>
                  <span>Away: {latestPrediction.winProbAway}%</span>
                </div>
              </div>

              {/* Detailed analyses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-800/60">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Tactical Commentary
                  </span>
                  <p className="text-sm text-gray-300 leading-relaxed">{latestPrediction.tacticalAnalysis}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Key Player Insight
                  </span>
                  <p className="text-sm text-gray-300 leading-relaxed">{latestPrediction.keyPlayerInsight}</p>
                </div>
              </div>

              {/* Score Prediction */}
              {latestPrediction.scorePrediction && (
                <div className="mt-6 p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase">AI Projected Final Score</span>
                  <span className="text-xl font-black text-emerald-400">{latestPrediction.scorePrediction}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-900/30 border border-gray-800/80 rounded-2xl p-6 text-center">
              <Sparkles className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">AI analysis will be compiled as the match progresses.</p>
            </div>
          )}

          {/* Roster & Squad Lineups */}
          <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-emerald-400" />
              Match Lineups & Rosters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Home Team Roster */}
              <div className="space-y-3">
                <div className="border-b border-gray-800 pb-2">
                  <span className="text-sm font-black text-emerald-400 uppercase tracking-wider">{match.homeTeam.name}</span>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {match.homeTeam.players?.map((player) => (
                    <div key={player.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="text-gray-300 font-medium">{player.name}</span>
                      <span className="text-xs bg-gray-950 px-2 py-0.5 rounded text-gray-400 font-bold uppercase w-8 text-center">{player.position || 'FW'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Away Team Roster */}
              <div className="space-y-3">
                <div className="border-b border-gray-800 pb-2">
                  <span className="text-sm font-black text-blue-400 uppercase tracking-wider">{match.awayTeam.name}</span>
                </div>
                <div className="divide-y divide-gray-800/40">
                  {match.awayTeam.players?.map((player) => (
                    <div key={player.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="text-gray-300 font-medium">{player.name}</span>
                      <span className="text-xs bg-gray-950 px-2 py-0.5 rounded text-gray-400 font-bold uppercase w-8 text-center">{player.position || 'FW'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Match Events Timeline */}
        <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-6 space-y-6">
          <h3 className="text-lg font-black text-white">Match Timeline</h3>

          <div className="relative border-l border-gray-800 pl-4 ml-2 space-y-6">
            {match.events.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 pl-2">No key match events recorded yet.</p>
            ) : (
              match.events.map((event) => (
                <div key={event.id} className="relative">
                  {/* Event indicator dot */}
                  <span className="absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-gray-950 ring-4 ring-emerald-500/10"></span>
                  
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-emerald-400 tracking-wider uppercase">{event.type}</span>
                      <span className="text-gray-500 font-bold">{event.minute}'</span>
                    </div>
                    <p className="text-sm font-semibold text-white">{event.detail || 'Match incident'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
