import { NextResponse } from 'next/server';
import { prisma } from '../../db';

export async function GET() {
  try {
    const standings = await prisma.standing.findMany({
      include: {
        team: true
      }
    });

    // Sort standings by points desc, goal difference desc, goalsFor desc
    const sortedStandings = standings.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      const goalDiffA = a.goalsFor - a.goalsAgainst;
      const goalDiffB = b.goalsFor - b.goalsAgainst;
      if (goalDiffB !== goalDiffA) {
        return goalDiffB - goalDiffA;
      }
      return b.goalsFor - a.goalsFor;
    });

    return NextResponse.json(sortedStandings);
  } catch (err: any) {
    console.error('API Error in /api/standings:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
