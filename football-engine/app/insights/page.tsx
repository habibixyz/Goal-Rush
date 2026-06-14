'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, HelpCircle, AlertCircle, Percent } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Prediction {
  id: string;
  predictedWinner: string;
  confidence: number;
  winProbHome: number;
  winProbAway: number;
  winProbDraw: number;
  tacticalAnalysis: string;
  keyPlayerInsight: string;
  scorePrediction: string;
  createdAt: string;
}

interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  scoreHome: number;
  scoreAway: number;
  status: string;
  minute: number;
  predictions: Prediction[];
}

export default function InsightsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatchesWithPredictions = async () => {
      try {
        const res = await fetch('/api/live');
        if (!res.ok) throw new Error('Failed to load active matches');
        const liveMatches: Match[] = await res.json();
        
        // Fetch full detail with predictions for each active match
        const matchesWithDetails = await Promise.all(
          liveMatches.map(async (m) => {
            const detailRes = await fetch(`/api/match/${m.id}`);
            if (detailRes.ok) return await detailRes.json();
            return m;
          })
        );
        
        setMatches(matchesWithDetails);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatchesWithPredictions();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium">Running tactical simulations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-xl mx-auto mt-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Could Not Load Predictions</h3>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  const matchesWithPredictions = matches.filter(m => m.predictions?.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-emerald-400 animate-pulse" /> AI Match Intelligence
        </h1>
        <p className="text-gray-400 text-sm">Real-time tactical commentary, win probabilities, and score projections</p>
      </div>

      {matchesWithPredictions.length === 0 ? (
        <div className="bg-gray-900/40 border border-gray-800 rounded-3xl p-12 text-center max-w-2xl mx-auto">
          <HelpCircle className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-1">No Insights Compiled</h3>
          <p className="text-gray-500 text-sm">There are no live matches with generated predictions yet. Make sure to run the AI Analyst service to populate predictions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {matchesWithPredictions.map((match) => {
            const pred = match.predictions[0];
            return (
              <div key={match.id} className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 border border-gray-800/80 rounded-2xl p-6 shadow-xl space-y-6">
                
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-4">
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-white">
                      {match.homeTeam.name} vs {match.awayTeam.name}
                    </span>
                    <span className="text-sm bg-gray-950 text-gray-400 px-3 py-1 rounded-full border border-gray-800 font-bold">
                      {match.scoreHome} : {match.scoreAway}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                    <Percent className="h-3.5 w-3.5" /> AI Pick: {pred.predictedWinner}
                  </div>
                </div>

                {/* Win Prob Split */}
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-gray-400">
                    <span>Win Probabilities (Confidence: {(pred.confidence * 100).toFixed(0)}%)</span>
                    <span className="text-emerald-400">Projected Score: {pred.scorePrediction}</span>
                  </div>
                  <div className="flex h-4 w-full bg-gray-950 rounded-full overflow-hidden p-0.5 border border-gray-800/60">
                    <div style={{ width: `${pred.winProbHome}%` }} className="bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"></div>
                    <div style={{ width: `${pred.winProbDraw}%` }} className="bg-gray-700 transition-all duration-300"></div>
                    <div style={{ width: `${pred.winProbAway}%` }} className="bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 px-1 font-semibold">
                    <span>{match.homeTeam.name}: {pred.winProbHome}%</span>
                    <span>Draw: {pred.winProbDraw}%</span>
                    <span>{match.awayTeam.name}: {pred.winProbAway}%</span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-800/40">
                  <div className="space-y-1">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Tactical Summary</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{pred.tacticalAnalysis}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest block">Key Player Analysis</span>
                    <p className="text-sm text-gray-300 leading-relaxed">{pred.keyPlayerInsight}</p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
