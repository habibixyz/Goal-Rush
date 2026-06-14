import prisma from '../db/prisma.js';
import * as sofascore from '../services/sofascore.js';
import { publishEvent } from '../services/redis.js';
import { MatchStatus, EventType } from '@prisma/client';

export const runPollingJob = async () => {
  try {
    console.log(`[Collector] Starting poll cycle at ${new Date().toISOString()}`);
    
    // 1. Fetch live matches
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

      // Map SofaScore status to Prisma MatchStatus
      let status: MatchStatus = MatchStatus.LIVE;
      if (liveMatch.status === 'scheduled') status = MatchStatus.SCHEDULED;
      else if (liveMatch.status === 'finished') status = MatchStatus.FINISHED;

      // Check if match already exists in our database
      const existingMatch = await prisma.match.findUnique({
        where: { sofaId: liveMatch.id }
      });

      let match;
      if (!existingMatch) {
        // Create match
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
        console.log(`[Collector] Created new match on-chain/db: ${homeTeam.name} vs ${awayTeam.name}`);
        await publishEvent(`match:${match.id}`, 'match_created', { match });
      } else {
        // Diff match details
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
          console.log(`[Collector] Match update detected: ${homeTeam.name} ${match.scoreHome}-${match.scoreAway} ${awayTeam.name} (Min: ${match.minute})`);
          await publishEvent(`match:${match.id}`, 'match_updated', { match });
        } else {
          match = existingMatch;
        }
      }

      // 2. Fetch and Sync Lineups (once per match or periodically)
      const lineups = await sofascore.getMatchLineups(liveMatch.id);
      for (const line of [...lineups.home, ...lineups.away]) {
        const team = lineups.home.includes(line) ? homeTeam : awayTeam;
        await prisma.player.upsert({
          where: { sofaId: line.player.id },
          update: { name: line.player.name, position: line.player.position, number: line.player.number, teamId: team.id },
          create: { sofaId: line.player.id, name: line.player.name, position: line.player.position, number: line.player.number, teamId: team.id }
        });
      }

      // 3. Fetch and Sync Match Events
      const sofaEvents = await sofascore.getMatchEvents(liveMatch.id);
      for (const sofaEv of sofaEvents) {
        // Find if this event exists
        const existingEvent = await prisma.event.findUnique({
          where: { sofaId: sofaEv.id }
        });

        if (!existingEvent) {
          // Find player by name/id to link
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

          console.log(`[Collector] New event recorded: [${event.type}] ${sofaEv.playerName} at ${event.minute}'`);
          await publishEvent(`match:${match.id}`, 'new_event', {
            event: {
              id: event.id,
              type: event.type,
              minute: event.minute,
              detail: event.detail,
              player: sofaEv.playerName
            }
          });
        }
      }
    }

    // 4. Standings
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
