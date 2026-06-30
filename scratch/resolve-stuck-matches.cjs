const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const paths = [
  path.join(__dirname, '../backend/data/goalrush.db'),
  path.join(__dirname, '../football-engine/backend/data/goalrush.db')
];

for (const dbPath of paths) {
  if (!fs.existsSync(dbPath)) {
    console.log(`DB not found at: ${dbPath}, skipping.`);
    continue;
  }

  try {
    const db = new Database(dbPath);
    console.log(`Checking/Updating DB at: ${dbPath}`);

    // Update Germany vs Paraguay (espn_760489) and Netherlands vs Morocco (espn_760488) to FINISHED status
    const updateStmt = db.prepare("UPDATE matches SET status = 'FINISHED' WHERE id IN ('espn_760489', 'espn_760488')");
    const result = updateStmt.run();

    console.log(`  - Updated ${result.changes} matches to FINISHED.`);
    
    // Let's verify the status of these matches in the DB
    const selectStmt = db.prepare("SELECT id, home_team, away_team, status, raw FROM matches WHERE id IN ('espn_760489', 'espn_760488')");
    const matches = selectStmt.all();
    for (const m of matches) {
      console.log(`  - Match: ${m.home_team} vs ${m.away_team} | Status: ${m.status}`);
    }

    db.close();
  } catch (err) {
    console.error(`Error updating DB at ${dbPath}:`, err.message);
  }
}
