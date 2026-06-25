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

function log(msg) {
  console.log(`[AI-AGENT | ${new Date().toISOString()}] ${msg}`);
}

async function askOpenAIModel(prompt) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing from .env");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant", // Fast, open-source model
      messages: [
        {
          role: "system",
          content: "You are an expert sports data analyst AI. You read news and upcoming match details. You MUST respond with ONLY a single digit: 1 (if you predict the Home team will win), 2 (if you predict the Away team will win), or 3 (if you predict a Draw). Do not output any other text, reasoning, or characters. Just the number."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2, // Low temperature for deterministic predictions
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const answer = data.choices[0].message.content.trim();
  
  // STRICT PARSING: Only accept exactly "1", "2", or "3".
  if (answer === "1" || answer === "2" || answer === "3") {
    return parseInt(answer, 10);
  } else {
    throw new Error(`AI returned invalid format: "${answer}". Expected 1, 2, or 3.`);
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
    const stateFile = path.join(__dirname, '../../data/agent-state.json');
    const claimedFile = path.join(__dirname, '../../data/agent-claimed.json');
    
    let predictedMatches = [];
    if (fs.existsSync(stateFile)) {
      predictedMatches = JSON.parse(fs.readFileSync(stateFile));
    }

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

    // 4. Fetch Match Data from Local Database
    // Note: matchId in our DB might be "espn_xxx". The on-chain ID is the keccak hash.
    // For simplicity, we just fetch the most recent 'LIVE' or 'SCHEDULED' match that fits.
    // Or we just get the latest news to feed the AI.
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

    // We don't know the exact teams from activeMatchId easily without querying hook.matches(id),
    // but we can ask the AI based on the general news context what the strongest bet is,
    // or we fetch upcoming matches.
    const upcomingMatches = db.getUpcomingMatches(24);
    const liveMatches = db.getLiveMatches();
    const candidateMatch = liveMatches.length > 0 ? liveMatches[0] : (upcomingMatches.length > 0 ? upcomingMatches[0] : null);

    if (!candidateMatch) {
      log("Could not find match context in DB. Skipping.");
      return;
    }

    const prompt = `
${newsContext}

UPCOMING MATCH:
Home Team: ${candidateMatch.home_team}
Away Team: ${candidateMatch.away_team}
Status: ${candidateMatch.status}

Based on the news and teams, who is more likely to win?
Remember, ONLY output:
1 for ${candidateMatch.home_team}
2 for ${candidateMatch.away_team}
3 for Draw
`;

    log(`Sending context to Llama-3 (Groq)...`);
    
    // 5. Ask the AI Model
    const prediction = await askOpenAIModel(prompt);
    
    const teamString = prediction === 1 ? candidateMatch.home_team : (prediction === 2 ? candidateMatch.away_team : "Draw");
    log(`🧠 AI Prediction: ${prediction} (${teamString})`);

    // 6. Execute Transaction (Strict Limit Applied)
    const amountWei = ethers.parseEther(MAX_PREDICTION_AMOUNT_OKB);
    log(`Submitting transaction to router... Amount: ${MAX_PREDICTION_AMOUNT_OKB} OKB`);
    
    const tx = await router.predictWithOKB(activeMatchId, prediction, {
      value: amountWei,
      gasLimit: 300000
    });

    log(`✅ Transaction submitted! Hash: ${tx.hash}`);
    await tx.wait(1);
    log(`🎯 Prediction locked on-chain successfully.`);

    // Mark as predicted
    predictedMatches.push(activeMatchId);
    fs.writeFileSync(stateFile, JSON.stringify(predictedMatches));

  } catch (error) {
    log(`❌ Error in agent loop: ${error.message}`);
  }
}

// ─── START AGENT ─────────────────────────────────────────────────────────────

log("Starting GoalRush AGI Agent...");
log(`Hardcoded betting limit: ${MAX_PREDICTION_AMOUNT_OKB} OKB`);

// Run immediately once
runAgent();

// Then run on interval
setInterval(runAgent, POLL_INTERVAL_MS);
