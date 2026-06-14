import { NextResponse } from 'next/server';
import { prisma } from '../../db';

export async function GET() {
  try {
    const matches = await prisma.match.findMany({
      where: {
        status: {
          in: ['LIVE', 'SCHEDULED']
        }
      },
      include: {
        homeTeam: true,
        awayTeam: true
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    return NextResponse.json(matches);
  } catch (err: any) {
    console.error('API Error in /api/live:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
