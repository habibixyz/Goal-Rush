const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, '../data/goalrush.db');
  console.log('Opening DB at:', dbPath);
  const db = new Database(dbPath);
  const matches = db.prepare('SELECT * FROM matches ORDER BY kickoff_utc').all();
  console.log(`Total matches in local SQLite: ${matches.length}`);
  matches.forEach(m => {
    console.log(`ID: ${m.id} | ${m.home_team} vs ${m.away_team} | Status: ${m.status} | Kickoff: ${m.kickoff_utc}`);
  });
} catch (e) {
  console.error('Error opening local SQLite:', e);
}
