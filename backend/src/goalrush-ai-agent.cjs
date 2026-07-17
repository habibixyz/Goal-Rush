require('dotenv').config({ path: '../../.env' }); // Adjusted for running in backend/src if needed
const path = require('path');
// Also try to load from project root just in case
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { ethers } = require('ethers');
const db = require('./db.js');

// ─── SECURITY & CONFIGURATION ───────────────────────────────────────────────
// STRICT BOUNDARY: The AI model ONLY receives strings of news and matches.
// It NEVER has access to the private key, the ethers wallet, or the RPC endpoint.
// Even if the AI tries to output malicious code, the script only parses for "1", "2", or "3".

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.XLAYER_MAINNET_RPC || 'https://rpc.xlayer.tech';
const ROUTER_ADDRESS = '0x8f3e9B45a377cEa9fCeC9509e82EEe237e67ba24';
const HOOK_ADDRESS = '0x700656337a252A004Ca0B170828f4adEaa680288';

// HARD LIMIT: No matter what the AI says, the agent can NEVER bet more than this amount.
const MAX_PREDICTION_AMOUNT_OKB = "0.0001"; 

// How often the agent runs (10 minutes)
const POLL_INTERVAL_MS = 10 * 60 * 1000;

// Minimal ABI for the prediction router & hook
const ROUTER_ABI = [
  'function predictWithOKB(uint256 _matchId, uint8 predictedTeam) external payable'
];

const HOOK_ABI = [
  'function activeMatchId() external view returns (uint256)',
  'function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)',
  'function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] memory okbAmounts, uint256[4] memory grushAmounts, bool[4] memory okbClaimeds, bool[4] memory grushClaimeds)',
  'function claimJackpot(uint256 _matchId) external'
];



// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
const agentLogBuffer = [];
const MAX_LOGS = 50;

function log(msg) {
  const line = `[AI-AGENT | ${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET] ${msg}`;
  console.log(line);
  agentLogBuffer.push(line);
  if (agentLogBuffer.length > MAX_LOGS) {
    agentLogBuffer.shift();
  }
}

async function askOpenAIModel(prompt, modelName) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing from .env");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are an expert sports data analyst AI part of a Consensus Swarm. You MUST respond with ONLY a valid JSON object containing exactly two keys: 'prediction' (Number: 1 for Home, 2 for Away, 3 for Draw) and 'reasoning' (String: a 1-sentence tactical explanation)."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.2,
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content.trim();
    
    const parsed = JSON.parse(answer);
    if (![1, 2, 3].includes(parsed.prediction)) {
       throw new Error("Invalid prediction number");
    }
    return parsed;
  } catch (e) {
    clearTimeout(timeoutId);
    throw new Error(`AI model error: ${e.message}`);
  }
}

// ─── MAIN AGENT LOOP ─────────────────────────────────────────────────────────

async function runAgent() {
  log("Waking up...");
  
  if (!PRIVATE_KEY) {
    log("ERROR: No PRIVATE_KEY found. Exiting.");
    return;
  }

  try {
    // 1. Initialize Database
    try {
      db.getDb();
    } catch(e) {
      db.init(); // Initialize if not already
    }

    // 2. Setup Blockchain Connection
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    // Note: Use wallet for hook so we can send the claimJackpot transaction
    const hook = new ethers.Contract(HOOK_ADDRESS, HOOK_ABI, wallet);

    // ─── AUTO-CLAIM LOOP ───────────────────────────────────────────────────
    const fs = require('fs');
    const stateFile = path.join(__dirname, '../data/agent-state.json');
    const claimedFile = path.join(__dirname, '../data/agent-claimed.json');
    
    let predictedMatches = [];
    if (fs.existsSync(stateFile)) {
      predictedMatches = JSON.parse(fs.readFileSync(stateFile));
    }

    // ─── BACKFILL DATABASE PREDICTIONS FROM ON-CHAIN ───────────────────────
    try {
      const dbRaw = db.getDb();
      for (const pMatchId of predictedMatches) {
        // Find the match in SQLite matching this on-chain ID
        const allDbMatches = db.getAllMatches(100);
        const dbMatch = allDbMatches.find(m => {
          try {
            const derivedBigInt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(m.id)));
            return derivedBigInt === BigInt(pMatchId);
          } catch (e) {
            return false;
          }
        });
        const matchId = dbMatch ? dbMatch.id : `espn_${pMatchId}`;

        // Check if already in predictions table
        const existing = dbRaw.prepare("SELECT * FROM predictions WHERE match_id = ? AND wallet = ?").get(matchId, wallet.address);
        if (!existing) {
          log(`Backfilling missing database log for predicted match ${pMatchId}...`);
          const predictions = await hook.getUserPredictions(BigInt(pMatchId), wallet.address);
          const okbAmounts = predictions[0];
          
          let predictedTeam = 0;
          for (let i = 1; i <= 3; i++) {
            if (okbAmounts[i] > 0n) {
              predictedTeam = i;
              break;
            }
          }

          if (predictedTeam > 0) {
            let predType = "DRAW";
            if (predictedTeam === 1) predType = "HOME";
            if (predictedTeam === 2) predType = "AWAY";

            db.savePrediction({
              match_id: matchId,
              wallet: wallet.address,
              prediction: predType,
              amount: MAX_PREDICTION_AMOUNT_OKB,
              tx_hash: `0x_backfilled_${pMatchId.slice(-8)}`
            });
            log(`   ✅ Backfilled match ${matchId} (${predType}) to local DB.`);
          }
        }
      }
    } catch (backfillErr) {
      log(`⚠️ Failed to run backfill: ${backfillErr.message}`);
    }
    // ───────────────────────────────────────────────────────────────────────

    let claimedMatches = [];
    if (fs.existsSync(claimedFile)) {
      claimedMatches = JSON.parse(fs.readFileSync(claimedFile));
    }

    for (const pMatchId of predictedMatches) {
      if (claimedMatches.includes(pMatchId)) continue;

      const pMatchDetails = await hook.matches(pMatchId);
      if (pMatchDetails.resolved) {
        log(`Checking past match ${pMatchId} for winnings...`);
        const winnerTeam = pMatchDetails.winner;

        // Fetch predictions
        const predictions = await hook.getUserPredictions(pMatchId, wallet.address);
        const okbAmounts = predictions[0];
        const okbClaimeds = predictions[2];

        const amountBetOnWinner = okbAmounts[winnerTeam];
        const hasClaimed = okbClaimeds[winnerTeam];

        if (amountBetOnWinner > 0n && !hasClaimed) {
          log(`🏆 AI WON MATCH ${pMatchId}! Claiming OKB Jackpot...`);
          try {
            const tx = await hook.claimJackpot(pMatchId, { gasLimit: 300000 });
            log(`   ↪ TX submitted: ${tx.hash}`);
            await tx.wait(1);
            log(`   ✅ Winnings claimed successfully!`);
          } catch (e) {
            log(`   ❌ Error claiming: ${e.message}`);
          }
        } else if (amountBetOnWinner === 0n) {
          log(`AI lost or Draw occurred for match ${pMatchId}. No winnings to claim.`);
        }

        // Mark as processed (claimed or lost) so we don't check again
        claimedMatches.push(pMatchId);
        fs.writeFileSync(claimedFile, JSON.stringify(claimedMatches));
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    // 3. Find the Active Match on Blockchain
    const activeMatchIdBigInt = await hook.activeMatchId();
    if (activeMatchIdBigInt === 0n) {
      log("No active match on-chain currently. Going back to sleep.");
      return;
    }

    const activeMatchId = activeMatchIdBigInt.toString();

    // Prevent duplicate bets on the same match across server restarts
    if (predictedMatches.includes(activeMatchId)) {
      log(`Already predicted on active match ${activeMatchId}. Waiting for next match.`);
      return;
    }

    const matchDetails = await hook.matches(activeMatchIdBigInt);
    const endTime = Number(matchDetails.endTime);
    const isResolved = matchDetails.resolved;
    const nowSec = Math.floor(Date.now() / 1000);

    if (isResolved || nowSec >= endTime) {
      log(`Match ${activeMatchId} is already resolved or predictions are closed. Skipping.`);
      return;
    }

    // 4. Fetch Match Data from Local Database for Context
    // We already know the exact teams from activeMatchId via hook.matches(id)
    log(`Active Match ID detected on-chain: ${activeMatchId}`);
    
    // Fetch latest news to give the AI context
    const recentNews = db.getNewsArticles(5); 
    if (recentNews.length === 0) {
      log("No news found in DB to base prediction on. Skipping.");
      return;
    }

    let newsContext = "RECENT SPORTS NEWS:\\n";
    recentNews.forEach(article => {
      newsContext += `- ${article.title}: ${article.summary}\\n`;
    });

    const teamA = matchDetails.teamA;
    const teamB = matchDetails.teamB;

    const prompt = `
${newsContext}

UPCOMING MATCH:
Home Team: ${teamA}
Away Team: ${teamB}
Status: LIVE

Analyze the match based on the news and return a JSON object with your prediction (1 for ${teamA}, 2 for ${teamB}, 3 for Draw) and your reasoning.
`;

    log(`> Initiating Multi-Agent Consensus Swarm for match ${activeMatchId}...`);
    
    // 5. Ask the AI Swarm
    const models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b'];
    const votes = [];
    
    for (const model of models) {
      try {
        log(`> [${model}] Analyzing match data...`);
        const result = await askOpenAIModel(prompt, model);
        const teamString = result.prediction === 1 ? teamA : (result.prediction === 2 ? teamB : "Draw");
        log(`> [${model}] Predicts: ${teamString} (Reason: ${result.reasoning})`);
        votes.push(result.prediction);
      } catch (err) {
        log(`> [${model}] Failed to analyze: ${err.message}`);
      }
    }

    if (votes.length < 2) {
      log(`> ⚠️ Swarm failed to reach quorum (Need at least 2 successful votes). Skipping.`);
      return;
    }

    // Tally votes
    const tally = { 1: 0, 2: 0, 3: 0 };
    votes.forEach(v => tally[v]++);
    
    let consensusPrediction = null;
    let maxVotes = 0;
    for (const [pred, count] of Object.entries(tally)) {
      if (count >= 2) { // Need at least 2 out of 3
        consensusPrediction = parseInt(pred, 10);
        maxVotes = count;
      }
    }

    if (!consensusPrediction) {
      log(`> ⚖️ Swarm split (No majority). Executive Agent aborting transaction to preserve funds.`);
      return;
    }

    const consensusString = consensusPrediction === 1 ? teamA : (consensusPrediction === 2 ? teamB : "Draw");
    log(`> 🧠 Executive Agent Consensus Reached: ${consensusString} (${maxVotes}/${votes.length} votes)`);

    // 6. Execute Transaction (Strict Limit Applied)
    const amountWei = ethers.parseEther(MAX_PREDICTION_AMOUNT_OKB);
    log(`Submitting transaction to router... Amount: ${MAX_PREDICTION_AMOUNT_OKB} OKB`);
    
    const tx = await router.predictWithOKB(activeMatchId, consensusPrediction, {
      value: amountWei,
      gasLimit: 300000
    });

    log(`> ✅ Executive Tx submitted! Hash: ${tx.hash}`);
    await tx.wait(1);
    log(`> 🎯 Prediction locked on-chain successfully.`);

    // Save to local database
    let predType = "DRAW";
    if (consensusPrediction === 1) predType = "HOME";
    if (consensusPrediction === 2) predType = "AWAY";

    let matchId = `espn_${activeMatchId}`;
    try {
      const allDbMatches = db.getAllMatches(100);
      const dbMatch = allDbMatches.find(m => {
        try {
          const derivedBigInt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(m.id)));
          return derivedBigInt === activeMatchIdBigInt;
        } catch (e) {
          return false;
        }
      });
      if (dbMatch) {
        matchId = dbMatch.id;
      }
    } catch (e) {
      log(`> ⚠️ Error finding matching database match: ${e.message}`);
    }

    try {
      db.savePrediction({
        match_id: matchId,
        wallet: wallet.address,
        prediction: predType,
        amount: MAX_PREDICTION_AMOUNT_OKB,
        tx_hash: tx.hash
      });
      log(`> 💾 Registered autonomous prediction in local database.`);
    } catch (dbErr) {
      log(`> ⚠️ Failed to save prediction to DB: ${dbErr.message}`);
    }

    // Mark as predicted
    predictedMatches.push(activeMatchId);
    fs.writeFileSync(stateFile, JSON.stringify(predictedMatches));

  } catch (error) {
    log(`❌ Error in agent loop: ${error.message}`);
  }
}

// ─── START AGENT ─────────────────────────────────────────────────────────────

log("> Booting GoalRush Sentient Swarm Agent...");
log(`> Hard Boundary execution limit: ${MAX_PREDICTION_AMOUNT_OKB} OKB`);

// Run immediately once to process any pending claims on startup
runAgent();

// Note: Agent is no longer running on an interval. 
// It is triggered by keeper.js upon match activation and match resolution.

module.exports = {
  getAgentLogs: () => agentLogBuffer,
  runAgent,
  askOpenAIModel
};
