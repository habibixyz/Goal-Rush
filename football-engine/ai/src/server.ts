import prisma from './db/prisma.js';
import Redis from 'ioredis';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const openaiApiKey = process.env.OPENAI_API_KEY || '';

// Initialize OpenAI SDK if key is set
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Initialize Redis Subscriber
const subscriber = new Redis(redisUrl);

console.log('[AI Analyst] Starting AI Match Analyst Service...');

// Cache to prevent duplicate analyses within 60 seconds
const analysisCooldown = new Map<string, number>();

const analyzeMatch = async (matchId: string) => {
  const now = Date.now();
  const lastAnalyzed = analysisCooldown.get(matchId) || 0;
  if (now - lastAnalyzed < 60000) {
    console.log(`[AI Analyst] Cooldown active for match ${matchId}. Skipping analysis.`);
    return;
  }
  analysisCooldown.set(matchId, now);

  try {
    console.log(`[AI Analyst] Fetching match data for match ${matchId}...`);
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        events: {
          orderBy: { minute: 'asc' }
        }
      }
    });

    if (!match) {
      console.warn(`[AI Analyst] Match ${matchId} not found in database.`);
      return;
    }

    console.log(`[AI Analyst] Run analysis for: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.scoreHome}-${match.scoreAway})`);

    let analysisResult;

    if (openai) {
      try {
        const prompt = `
You are an elite football tactical analyst and data scientist. Analyze the following live football match:
Match: ${match.homeTeam.name} vs ${match.awayTeam.name}
Current Score: ${match.homeTeam.name} ${match.scoreHome} - ${match.scoreAway} ${match.awayTeam.name}
Current Minute: ${match.minute}'
Match Status: ${match.status}

Events so far:
${match.events.map(e => `- Minute ${e.minute}: [${e.type}] ${e.detail || ''}`).join('\n')}

Generate the win probability split (Home Win, Away Win, Draw) totaling 100%, tactical analysis of the match's shape and likely adjustments, key player insights, and a final scoreline prediction.

Return ONLY a valid JSON object matching this TypeScript interface:
{
  "predictedWinner": "HOME" | "AWAY" | "DRAW",
  "confidence": number, // 0.0 to 1.0
  "winProbHome": number, // percentage, e.g. 45.5
  "winProbAway": number, // percentage
  "winProbDraw": number, // percentage
  "tacticalAnalysis": string, // 2-3 sentences
  "keyPlayerInsight": string, // 1-2 sentences
  "scorePrediction": string // e.g. "2-1"
}
        `;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });

        const text = response.choices[0]?.message?.content;
        if (text) {
          analysisResult = JSON.parse(text);
        }
      } catch (openaiErr) {
        console.error('[AI Analyst] OpenAI analysis failed, falling back to local heuristic:', openaiErr);
      }
    }

    // Heuristic Local Fallback Analysis Engine
    if (!analysisResult) {
      const min = match.minute || 0;
      const scoreDiff = match.scoreHome - match.scoreAway;
      
      let winProbHome = 33.3;
      let winProbAway = 33.3;
      let winProbDraw = 33.4;

      if (scoreDiff > 0) {
        // Home team is leading
        const timeFactor = min / 90;
        winProbHome = 50 + (scoreDiff * 15) + (timeFactor * 25);
        winProbAway = Math.max(5, 25 - (scoreDiff * 10) - (timeFactor * 15));
        winProbDraw = 100 - winProbHome - winProbAway;
      } else if (scoreDiff < 0) {
        // Away team is leading
        const absDiff = Math.abs(scoreDiff);
        const timeFactor = min / 90;
        winProbAway = 50 + (absDiff * 15) + (timeFactor * 25);
        winProbHome = Math.max(5, 25 - (absDiff * 10) - (timeFactor * 15));
        winProbDraw = 100 - winProbAway - winProbHome;
      } else {
        // Draw
        const timeFactor = min / 90;
        winProbDraw = 40 + (timeFactor * 40);
        winProbHome = (100 - winProbDraw) / 2;
        winProbAway = winProbHome;
      }

      // Round percentages
      winProbHome = Math.round(winProbHome * 10) / 10;
      winProbAway = Math.round(winProbAway * 10) / 10;
      winProbDraw = Math.round(winProbDraw * 10) / 10;

      let predictedWinner: 'HOME' | 'AWAY' | 'DRAW' = 'DRAW';
      if (winProbHome > winProbAway && winProbHome > winProbDraw) predictedWinner = 'HOME';
      if (winProbAway > winProbHome && winProbAway > winProbDraw) predictedWinner = 'AWAY';

      const confidence = Math.max(0.4, Math.abs(winProbHome - winProbAway) / 100);

      const tacticalAnalysis = scoreDiff === 0 
        ? `${match.homeTeam.name} and ${match.awayTeam.name} remain locked in a tactical stalemate. Both managers are employing cautious defensive lines, prioritizing midfield containment over aggressive attacking transitions.`
        : `${scoreDiff > 0 ? match.homeTeam.name : match.awayTeam.name} is capitalizing on defensive structural gaps. Expect tactical shifts as the trailing team commits more numbers forward to salvage a result.`;

      const keyPlayerInsight = `Key midfielders are driving the tempo. The team that wins the secondary pressing duels in the final 20 minutes is likely to secure all three points.`;

      const scorePrediction = `${match.scoreHome + (winProbHome > 40 ? 1 : 0)}-${match.scoreAway + (winProbAway > 40 ? 1 : 0)}`;

      analysisResult = {
        predictedWinner,
        confidence,
        winProbHome,
        winProbAway,
        winProbDraw,
        tacticalAnalysis,
        keyPlayerInsight,
        scorePrediction
      };
    }

    // Save Prediction record to Database
    const prediction = await prisma.prediction.create({
      data: {
        matchId: match.id,
        predictedWinner: analysisResult.predictedWinner,
        confidence: analysisResult.confidence,
        winProbHome: analysisResult.winProbHome,
        winProbAway: analysisResult.winProbAway,
        winProbDraw: analysisResult.winProbDraw,
        tacticalAnalysis: analysisResult.tacticalAnalysis,
        keyPlayerInsight: analysisResult.keyPlayerInsight,
        scorePrediction: analysisResult.scorePrediction
      }
    });

    console.log(`[AI Analyst] Prediction saved successfully. Match: ${match.homeTeam.name} vs ${match.awayTeam.name}. Predicted Winner: ${prediction.predictedWinner} (${analysisResult.winProbHome}% / ${analysisResult.winProbDraw}% / ${analysisResult.winProbAway}%)`);

  } catch (err) {
    console.error(`[AI Analyst] Error analyzing match ${matchId}:`, err);
  }
};

// Listen to match changes and new events via Redis
subscriber.psubscribe('match:*').then(() => {
  console.log('[AI Analyst] Subscribed to match:* channels');
});

subscriber.on('pmessage', async (pattern, channel, message) => {
  try {
    const matchId = channel.split(':')[1];
    const payload = JSON.parse(message);
    const { type } = payload;

    // Trigger analysis on match updates or key events
    if (type === 'match_updated' || type === 'new_event') {
      console.log(`[AI Analyst] Event [${type}] received. Scheduling analysis for match ${matchId}...`);
      await analyzeMatch(matchId);
    }
  } catch (err) {
    console.error('[AI Analyst] Failed to handle message from Redis:', err);
  }
});
