import { NextResponse } from 'next/server';
import { prisma } from '../../../db.js';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const player = await prisma.player.findUnique({
      where: { id },
      include: {
        team: true,
        events: {
          include: {
            match: {
              include: { homeTeam: true, awayTeam: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (err: any) {
    console.error('API Error in /api/player/[id]:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
