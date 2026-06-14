'use client';

import React, { useEffect, useState } from 'react';
import { Award, ShieldAlert } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  shortName: string;
}

interface Standing {
  id: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  team: Team;
}

export default function StandingsPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const res = await fetch('/api/standings');
        if (!res.ok) throw new Error('Failed to fetch league standings');
        const data = await res.json();
        setStandings(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStandings();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium">Reconciling league standings table...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-xl mx-auto mt-12 text-center">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Failed to Query Standings</h3>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl flex items-center gap-2">
          <Award className="h-7 w-7 text-emerald-400" /> Standings Table
        </h1>
        <p className="text-gray-400 text-sm">Standings and goal differences calculated directly from live feeds</p>
      </div>

      <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800/60 text-sm text-left">
            <thead className="bg-gray-900/50 text-gray-400 font-black uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 text-center w-16">Pos</th>
                <th className="px-6 py-4">Team</th>
                <th className="px-6 py-4 text-center">P</th>
                <th className="px-6 py-4 text-center">W</th>
                <th className="px-6 py-4 text-center">D</th>
                <th className="px-6 py-4 text-center">L</th>
                <th className="px-6 py-4 text-center">GF</th>
                <th className="px-6 py-4 text-center">GA</th>
                <th className="px-6 py-4 text-center">GD</th>
                <th className="px-6 py-4 text-center text-emerald-400">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/40 text-gray-300 font-medium">
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    No team standings data found. Run the collector service to initialize.
                  </td>
                </tr>
              ) : (
                standings.map((std, idx) => {
                  const goalDiff = std.goalsFor - std.goalsAgainst;
                  return (
                    <tr key={std.id} className="hover:bg-gray-900/25 transition">
                      <td className="px-6 py-4 text-center font-extrabold text-white">{idx + 1}</td>
                      <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                        {std.team.name}
                        <span className="text-xs text-gray-500 uppercase tracking-widest font-normal">({std.team.shortName || 'T'})</span>
                      </td>
                      <td className="px-6 py-4 text-center">{std.played}</td>
                      <td className="px-6 py-4 text-center">{std.won}</td>
                      <td className="px-6 py-4 text-center">{std.drawn}</td>
                      <td className="px-6 py-4 text-center">{std.lost}</td>
                      <td className="px-6 py-4 text-center">{std.goalsFor}</td>
                      <td className="px-6 py-4 text-center">{std.goalsAgainst}</td>
                      <td className={`px-6 py-4 text-center font-bold ${goalDiff > 0 ? 'text-emerald-400' : goalDiff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {goalDiff > 0 ? `+${goalDiff}` : goalDiff}
                      </td>
                      <td className="px-6 py-4 text-center font-black text-emerald-400 text-base">{std.points}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
