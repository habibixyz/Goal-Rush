/**
 * resolver.js
 * When a match status = FINISHED and scores are known,
 * this module calls your GoalRush smart contract's resolveMatch()
 * automatically — no wallet needed on the server (uses a backend
 * "oracle" private key stored safely in Railway env vars).
 *
 * ENV VARS REQUIRED:
 *   ORACLE_PRIVATE_KEY   — wallet that has the ORACLE role on your contract
 *   CONTRACT_ADDRESS     — your GoalRush contract address
 *   RPC_URL              — e.g. https://polygon-rpc.com or Alchemy/Infura free URL
 */

const { ethers } = require('ethers');
const db = require('./db');

// Minimal ABI — only the functions we call
const CONTRACT_ABI = [
  'function resolveMatch(uint256 matchId, uint8 result) external',
  'function getMatch(uint256 matchId) external view returns (uint8 status, uint8 result)',
  'event MatchResolved(uint256 indexed matchId, uint8 result)',
];

// result enum: 1=HOME_WIN, 2=AWAY_WIN, 3=DRAW (must match your contract)
const RESULT = { HOME: 1, AWAY: 2, DRAW: 3 };

let provider, signer, contract;

function initContract() {
  const RPC_URL = process.env.RPC_URL;
  const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY;
  const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS;

  if (!RPC_URL || !ORACLE_KEY || !CONTRACT_ADDR) {
    console.warn('[RESOLVER] Missing env vars — auto-resolution disabled');
    return false;
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  signer = new ethers.Wallet(ORACLE_KEY, provider);
  contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer);
  console.log('[RESOLVER] Contract initialized at', CONTRACT_ADDR);
  return true;
}

const contractReady = initContract();

// ─── Determine result from scores ─────────────────────────
function getResult(homeScore, awayScore) {
  if (homeScore > awayScore) return RESULT.HOME;
  if (homeScore < awayScore) return RESULT.AWAY;
  return RESULT.DRAW;
}

// Track which match IDs we've already resolved to avoid double calls
const resolvedCache = new Set();

async function resolveFinishedMatches() {
  if (!contractReady) return;

  const finished = db.getFinishedUnresolved();
  if (!finished.length) return;

  for (const match of finished) {
    // Only matches that have a numeric contract match ID embedded
    // We expect match.id to be like "espn_12345" → contractId derived from your
    // frontend when the match was registered on-chain.
    // You'll store the on-chain matchId in the DB when the match is created.
    const contractMatchId = match.contract_match_id;
    if (!contractMatchId) continue;
    if (resolvedCache.has(contractMatchId)) continue;

    const homeScore = match.home_score;
    const awayScore = match.away_score;
    if (homeScore === null || awayScore === null) continue;

    const result = getResult(homeScore, awayScore);

    try {
      // First check if already resolved on-chain (avoid wasted gas)
      const onChain = await contract.getMatch(contractMatchId);
      if (onChain.status === 2) { // 2 = RESOLVED in your enum
        resolvedCache.add(contractMatchId);
        continue;
      }

      console.log(`[RESOLVER] Resolving match ${contractMatchId} result=${result} (${homeScore}-${awayScore})`);
      const tx = await contract.resolveMatch(contractMatchId, result, {
        gasLimit: 300000,
      });
      await tx.wait();
      console.log(`[RESOLVER] ✅ Match ${contractMatchId} resolved — tx: ${tx.hash}`);
      resolvedCache.add(contractMatchId);
    } catch (err) {
      console.error(`[RESOLVER] Failed match ${contractMatchId}:`, err.message);
    }
  }
}

// ─── Manual resolve endpoint (for admin use) ──────────────
async function resolveMatchManually(contractMatchId, homeScore, awayScore) {
  if (!contractReady) throw new Error('Contract not initialized');
  const result = getResult(homeScore, awayScore);
  const tx = await contract.resolveMatch(contractMatchId, result, { gasLimit: 300000 });
  await tx.wait();
  return tx.hash;
}

module.exports = { resolveFinishedMatches, resolveMatchManually };
