const Database = require('../backend/node_modules/better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../backend/data/goalrush.db');
const db = new Database(DB_PATH);

console.log("Reading matches from:", DB_PATH);
try {
  const matches = db.prepare("SELECT id, home_team, away_team, status, kickoff_utc, competition FROM matches ORDER BY kickoff_utc DESC").all();
  console.log(`Found ${matches.length} matches in database:\n`);
  matches.forEach(m => {
    console.log(`- ID: ${m.id} | ${m.home_team} vs ${m.away_team}`);
    console.log(`  Status: ${m.status} | Kickoff: ${m.kickoff_utc}`);
    console.log(`  Competition: ${m.competition}\n`);
  });
} catch (err) {
  console.error("Failed to query database:", err);
}
db.close();
