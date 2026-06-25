const { fetchAndStoreMatches } = require('../backend/src/fetcher');
const Database = require('../backend/node_modules/better-sqlite3');
const path = require('path');

const dbModule = require('../backend/src/db');

async function main() {
  console.log("Initializing database...");
  await dbModule.init();
  console.log("Running fetchAndStoreMatches...");
  try {
    await fetchAndStoreMatches();
    console.log("Fetcher successfully ran.");

    // Query DB
    const DB_PATH = path.join(__dirname, '../backend/data/goalrush.db');
    const db = new Database(DB_PATH);
    const matches = db.prepare("SELECT id, home_team, away_team, status, kickoff_utc, competition FROM matches ORDER BY kickoff_utc DESC").all();
    console.log(`\nFound ${matches.length} matches in database:\n`);
    matches.forEach(m => {
      console.log(`- ID: ${m.id} | ${m.home_team} vs ${m.away_team}`);
      console.log(`  Status: ${m.status} | Kickoff: ${m.kickoff_utc}`);
      console.log(`  Competition: ${m.competition}\n`);
    });
    db.close();
  } catch (err) {
    console.error("Error running fetcher or querying database:", err);
  }
}

main();
