const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/goalrush.db');

let db;

function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}

async function init() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      home_score INTEGER DEFAULT NULL,
      away_score INTEGER DEFAULT NULL,
      status TEXT DEFAULT 'SCHEDULED',   -- SCHEDULED | LIVE | FINISHED | POSTPONED
      kickoff_utc TEXT NOT NULL,
      competition TEXT,
      minute TEXT DEFAULT NULL,
      source TEXT,
      raw JSON,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      wallet TEXT NOT NULL,
      prediction TEXT NOT NULL,   -- HOME | DRAW | AWAY
      amount TEXT NOT NULL,
      tx_hash TEXT,
      claimed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS twitter_cards (
      wallet TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar_url TEXT,
      position TEXT NOT NULL,
      overall INTEGER NOT NULL,
      defi_iq INTEGER NOT NULL,
      prediction_power INTEGER NOT NULL,
      jackpot_luck INTEGER NOT NULL,
      degen_level INTEGER NOT NULL,
      swap_speed INTEGER NOT NULL,
      x_factor INTEGER NOT NULL,
      card_type TEXT NOT NULL,
      tx_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
    CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches(kickoff_utc);
    CREATE INDEX IF NOT EXISTS idx_predictions_match ON predictions(match_id);
    CREATE INDEX IF NOT EXISTS idx_predictions_wallet ON predictions(wallet);
    CREATE INDEX IF NOT EXISTS idx_twitter_cards_created ON twitter_cards(created_at);
  `);

  // Purge any non-World Cup matches
  db.prepare("DELETE FROM matches WHERE competition NOT LIKE '%World Cup%'").run();

  console.log('✅ DB initialized at', DB_PATH);
}

// ─── Match helpers ────────────────────────────────────────
function upsertMatch(match) {
  const stmt = db.prepare(`
    INSERT INTO matches (id, home_team, away_team, home_score, away_score, status, kickoff_utc, competition, minute, source, raw, updated_at)
    VALUES (@id, @home_team, @away_team, @home_score, @away_score, @status, @kickoff_utc, @competition, @minute, @source, @raw, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      status = excluded.status,
      minute = excluded.minute,
      raw = excluded.raw,
      updated_at = datetime('now')
  `);
  stmt.run({ ...match, raw: JSON.stringify(match.raw || {}) });
}

function getMatchById(id) {
  return db.prepare('SELECT * FROM matches WHERE id = ?').get(id);
}

function getLiveMatches() {
  return db.prepare("SELECT * FROM matches WHERE status = 'LIVE' AND competition LIKE '%World Cup%' ORDER BY kickoff_utc").all();
}

function getUpcomingMatches(hours = 48) {
  return db.prepare(`
    SELECT * FROM matches
    WHERE status = 'SCHEDULED'
      AND kickoff_utc >= datetime('now')
      AND kickoff_utc <= datetime('now', '+${hours} hours')
      AND competition LIKE '%World Cup%'
    ORDER BY kickoff_utc
  `).all();
}

function getFinishedUnresolved() {
  // Matches finished in the last 2 hours that haven't been checked for resolution
  return db.prepare(`
    SELECT * FROM matches
    WHERE status = 'FINISHED'
      AND updated_at >= datetime('now', '-2 hours')
      AND competition LIKE '%World Cup%'
    ORDER BY kickoff_utc DESC
  `).all();
}

function getAllMatches(limit = 100) {
  return db.prepare(`
    SELECT * FROM matches
    WHERE competition LIKE '%World Cup%'
    ORDER BY kickoff_utc DESC
    LIMIT ?
  `).all(limit);
}

// ─── Prediction helpers ───────────────────────────────────
function savePrediction(p) {
  return db.prepare(`
    INSERT INTO predictions (match_id, wallet, prediction, amount, tx_hash)
    VALUES (@match_id, @wallet, @prediction, @amount, @tx_hash)
  `).run(p);
}

function getPredictionsByMatch(matchId) {
  return db.prepare('SELECT * FROM predictions WHERE match_id = ?').all(matchId);
}

function getPredictionsByWallet(wallet) {
  return db.prepare('SELECT p.*, m.home_team, m.away_team, m.home_score, m.away_score, m.status FROM predictions p JOIN matches m ON p.match_id = m.id WHERE p.wallet = ? ORDER BY p.created_at DESC').all(wallet);
}

function saveTwitterCard(card) {
  const stmt = db.prepare(`
    INSERT INTO twitter_cards (wallet, username, avatar_url, position, overall, defi_iq, prediction_power, jackpot_luck, degen_level, swap_speed, x_factor, card_type, tx_hash, created_at)
    VALUES (@wallet, @username, @avatar_url, @position, @overall, @defi_iq, @prediction_power, @jackpot_luck, @degen_level, @swap_speed, @x_factor, @card_type, @tx_hash, datetime('now'))
    ON CONFLICT(wallet) DO UPDATE SET
      username = excluded.username,
      avatar_url = excluded.avatar_url,
      position = excluded.position,
      overall = excluded.overall,
      defi_iq = excluded.defi_iq,
      prediction_power = excluded.prediction_power,
      jackpot_luck = excluded.jackpot_luck,
      degen_level = excluded.degen_level,
      swap_speed = excluded.swap_speed,
      x_factor = excluded.x_factor,
      card_type = excluded.card_type,
      tx_hash = excluded.tx_hash,
      created_at = datetime('now')
  `);
  stmt.run({
    ...card,
    wallet: card.wallet.toLowerCase()
  });
}

function getRecentTwitterCards(limit = 10) {
  return db.prepare('SELECT * FROM twitter_cards ORDER BY created_at DESC LIMIT ?').all(limit);
}

module.exports = {
  init,
  getDb,
  upsertMatch,
  getMatchById,
  getLiveMatches,
  getUpcomingMatches,
  getFinishedUnresolved,
  getAllMatches,
  savePrediction,
  getPredictionsByMatch,
  getPredictionsByWallet,
  saveTwitterCard,
  getRecentTwitterCards,
};
