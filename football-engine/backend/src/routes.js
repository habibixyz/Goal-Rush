const express = require('express');
const router = express.Router();
const db = require('./db');
const { fetchAndStoreMatches } = require('./fetcher');
const { resolveMatchManually } = require('./resolver');

// ── GET /api/matches/live ─────────────────────────────────
router.get('/matches/live', (req, res) => {
  try {
    const matches = db.getAllMatches();
    res.json({ success: true, data: matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/matches/upcoming ─────────────────────────────
router.get('/matches/upcoming', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 48;
    const matches = db.getUpcomingMatches(hours);
    res.json({ success: true, data: matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/matches/all ──────────────────────────────────
router.get('/matches/all', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const matches = db.getAllMatches(limit);
    res.json({ success: true, data: matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/matches/:id ──────────────────────────────────
router.get('/matches/:id', (req, res) => {
  try {
    const match = db.getMatchById(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/matches/refresh ─────────────────────────────
// Force an immediate data fetch (useful for admin / frontend trigger)
router.post('/matches/refresh', async (req, res) => {
  try {
    await fetchAndStoreMatches();
    res.json({ success: true, message: 'Matches refreshed' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/predictions/:wallet ─────────────────────────
router.get('/predictions/:wallet', (req, res) => {
  try {
    const predictions = db.getPredictionsByWallet(req.params.wallet.toLowerCase());
    res.json({ success: true, data: predictions });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/predictions ─────────────────────────────────
// Called from your frontend after a successful on-chain tx
router.post('/predictions', (req, res) => {
  try {
    const { match_id, wallet, prediction, amount, tx_hash } = req.body;
    if (!match_id || !wallet || !prediction || !amount) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    db.savePrediction({
      match_id,
      wallet: wallet.toLowerCase(),
      prediction: prediction.toUpperCase(),
      amount: String(amount),
      tx_hash: tx_hash || null,
    });
    res.json({ success: true, message: 'Prediction saved' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/admin/resolve ───────────────────────────────
// Manual resolution (protect this with ADMIN_SECRET env var)
router.post('/admin/resolve', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { contract_match_id, home_score, away_score } = req.body;
    const txHash = await resolveMatchManually(contract_match_id, home_score, away_score);
    res.json({ success: true, tx_hash: txHash });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/stats ────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const dbRaw = db.getDb();
    const live = dbRaw.prepare("SELECT COUNT(*) as c FROM matches WHERE status='LIVE'").get().c;
    const upcoming = dbRaw.prepare("SELECT COUNT(*) as c FROM matches WHERE status='SCHEDULED'").get().c;
    const finished = dbRaw.prepare("SELECT COUNT(*) as c FROM matches WHERE status='FINISHED'").get().c;
    const predictions = dbRaw.prepare("SELECT COUNT(*) as c FROM predictions").get().c;
    res.json({ success: true, data: { live, upcoming, finished, predictions } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
