import { NextResponse } from 'next/server';
import { prisma } from '../../../db.js';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: {
          include: {
            players: true
          }
        },
        awayTeam: {
          include: {
            players: true
          }
        },
        events: {
          orderBy: { minute: 'asc' }
        },
        predictions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (err: any) {
    console.error('API Error in /api/match/[id]:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
