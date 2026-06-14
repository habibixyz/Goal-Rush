import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import prisma from './db/prisma.js';
import * as sofascore from './services/sofascore.js';
import { analyzeMatch } from './services/ai.js';
import { MatchStatus, EventType } from '@prisma/client';

dotenv.config();

const port = process.env.PORT || 4000;
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date(), service: 'goal-rush-backend' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Event deduplication cache (stores event hash for 30 seconds)
const processedEvents = new Set<string>();

const isDuplicateEvent = (matchId: string, eventType: string, payload: any): boolean => {
  let eventHash = `${matchId}:${eventType}`;
  if (payload.event && payload.event.id) {
    eventHash += `:${payload.event.id}`;
  } else if (payload.match && payload.match.updatedAt) {
    eventHash += `:${payload.match.updatedAt}`;
  } else {
    eventHash += `:${JSON.stringify(payload)}`;
  }

  if (processedEvents.has(eventHash)) {
    return true;
  }

  processedEvents.add(eventHash);
  setTimeout(() => processedEvents.delete(eventHash), 30000);
  return false;
};

const broadcastMatchEvent = (matchId: string, type: string, payload: any) => {
  if (isDuplicateEvent(matchId, type, payload)) {
    return;
  }
  console.log(`[Socket] Broadcasting event [${type}] on room [match:${matchId}]`);
  io.to(`match:${matchId}`).emit('match_event', { type, ...payload });
};

// Client connections
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('join_match', (matchId: string) => {
    socket.join(`match:${matchId}`);
    console.log(`[Socket] Client ${socket.id} joined room: match:${matchId}`);
    socket.emit('joined_room', { matchId });
  });

  socket.on('leave_match', (matchId: string) => {
    socket.leave(`match:${matchId}`);
    console.log(`[Socket] Client ${socket.id} left room: match:${matchId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Polling Scheduler Loop
const runPollingJob = async () => {
  try {
    console.log(`[Collector] Starting poll cycle at ${new Date().toISOString()}`);
    const liveMatches = await sofascore.getLiveMatches();
    
    for (const liveMatch of liveMatches) {
      // Upsert Teams
      const homeTeam = await prisma.team.upsert({
        where: { sofaId: liveMatch.homeTeam.id },
        update: { name: liveMatch.homeTeam.name, shortName: liveMatch.homeTeam.shortName || null },
        create: { sofaId: liveMatch.homeTeam.id, name: liveMatch.homeTeam.name, shortName: liveMatch.homeTeam.shortName || null }
      });

      const awayTeam = await prisma.team.upsert({
        where: { sofaId: liveMatch.awayTeam.id },
        update: { name: liveMatch.awayTeam.name, shortName: liveMatch.awayTeam.shortName || null },
        create: { sofaId: liveMatch.awayTeam.id, name: liveMatch.awayTeam.name, shortName: liveMatch.awayTeam.shortName || null }
      });

      let status: MatchStatus = MatchStatus.LIVE;
      if (liveMatch.status === 'scheduled') status = MatchStatus.SCHEDULED;
      else if (liveMatch.status === 'finished') status = MatchStatus.FINISHED;

      const existingMatch = await prisma.match.findUnique({
        where: { sofaId: liveMatch.id }
      });

      let match;
      if (!existingMatch) {
        match = await prisma.match.create({
          data: {
            sofaId: liveMatch.id,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            status,
            scoreHome: liveMatch.homeScore,
            scoreAway: liveMatch.awayScore,
            minute: liveMatch.minute || 0,
            startTime: new Date(liveMatch.startTime)
          }
        });
        console.log(`[Collector] Created new match: ${homeTeam.name} vs ${awayTeam.name}`);
        broadcastMatchEvent(match.id, 'match_created', { match });
      } else {
        const changed = 
          existingMatch.scoreHome !== liveMatch.homeScore ||
          existingMatch.scoreAway !== liveMatch.awayScore ||
          existingMatch.status !== status ||
          existingMatch.minute !== liveMatch.minute;

        if (changed) {
          match = await prisma.match.update({
            where: { id: existingMatch.id },
            data: {
              scoreHome: liveMatch.homeScore,
              scoreAway: liveMatch.awayScore,
              status,
              minute: liveMatch.minute || 0
            }
          });
          console.log(`[Collector] Match update: ${homeTeam.name} ${match.scoreHome}-${match.scoreAway} ${awayTeam.name} (${match.minute}')`);
          broadcastMatchEvent(match.id, 'match_updated', { match });
          
          // Trigger background AI Analysis
          analyzeMatch(match.id).catch(err => console.error('[AI Analyst] Analysis error:', err));
        } else {
          match = existingMatch;
        }
      }

      // Sync Lineups
      const lineups = await sofascore.getMatchLineups(liveMatch.id);
      for (const line of [...lineups.home, ...lineups.away]) {
        const team = lineups.home.includes(line) ? homeTeam : awayTeam;
        await prisma.player.upsert({
          where: { sofaId: line.player.id },
          update: { name: line.player.name, position: line.player.position, number: line.player.number, teamId: team.id },
          create: { sofaId: line.player.id, name: line.player.name, position: line.player.position, number: line.player.number, teamId: team.id }
        });
      }

      // Sync Match Events
      const sofaEvents = await sofascore.getMatchEvents(liveMatch.id);
      for (const sofaEv of sofaEvents) {
        const existingEvent = await prisma.event.findUnique({
          where: { sofaId: sofaEv.id }
        });

        if (!existingEvent) {
          const player = await prisma.player.findFirst({
            where: { name: sofaEv.playerName }
          });

          const typeMapping: Record<string, EventType> = {
            'GOAL': EventType.GOAL,
            'YELLOW_CARD': EventType.YELLOW_CARD,
            'RED_CARD': EventType.RED_CARD,
            'SUBSTITUTION': EventType.SUBSTITUTION,
            'VAR': EventType.VAR
          };

          const event = await prisma.event.create({
            data: {
              sofaId: sofaEv.id,
              matchId: match.id,
              type: typeMapping[sofaEv.type] || EventType.VAR,
              minute: sofaEv.minute,
              detail: sofaEv.detail || null,
              playerAId: player?.id || null
            }
          });

          console.log(`[Collector] Recorded: [${event.type}] ${sofaEv.playerName} (${event.minute}')`);
          broadcastMatchEvent(match.id, 'new_event', {
            event: {
              id: event.id,
              type: event.type,
              minute: event.minute,
              detail: event.detail,
              player: sofaEv.playerName
            }
          });

          // Trigger background AI Analysis on new incident
          analyzeMatch(match.id).catch(err => console.error('[AI Analyst] Analysis error:', err));
        }
      }
    }

    // Standings
    const standings = await sofascore.getStandings();
    for (const std of standings) {
      const team = await prisma.team.findUnique({
        where: { sofaId: std.teamId }
      });
      if (team) {
        await prisma.standing.upsert({
          where: { teamId: team.id },
          update: {
            points: std.points,
            played: std.played,
            won: std.won,
            drawn: std.drawn,
            lost: std.lost,
            goalsFor: std.goalsFor,
            goalsAgainst: std.goalsAgainst
          },
          create: {
            teamId: team.id,
            points: std.points,
            played: std.played,
            won: std.won,
            drawn: std.drawn,
            lost: std.lost,
            goalsFor: std.goalsFor,
            goalsAgainst: std.goalsAgainst
          }
        });
      }
    }

  } catch (err) {
    console.error('[Collector] Error during poll cycle:', err);
  }
};

// Start Polling Loops
runPollingJob();
const POLL_INTERVAL = 15000;
setInterval(runPollingJob, POLL_INTERVAL);

// Start HTTP / socket.io server
httpServer.listen(port, () => {
  console.log(`[Backend] Combined server listening on port ${port}`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
