import { NextResponse } from 'next/server';
import { prisma } from '../../../db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        players: true,
        homeMatches: {
          include: { homeTeam: true, awayTeam: true },
          orderBy: { startTime: 'desc' },
          take: 5
        },
        awayMatches: {
          include: { homeTeam: true, awayTeam: true },
          orderBy: { startTime: 'desc' },
          take: 5
        },
        standings: true
      }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Combine and sort match history
    const matchHistory = [...team.homeMatches, ...team.awayMatches].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    ).slice(0, 5);

    return NextResponse.json({
      ...team,
      matchHistory
    });
  } catch (err: any) {
    console.error('API Error in /api/team/[id]:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
