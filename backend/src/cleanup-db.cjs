const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const paths = [
  path.join(__dirname, '../../backend/data/goalrush.db'),
  path.join(__dirname, '../../football-engine/backend/data/goalrush.db')
];

for (const dbPath of paths) {
  if (!fs.existsSync(dbPath)) {
    console.log(`DB not found at: ${dbPath}, skipping.`);
    continue;
  }

  try {
    const db = new Database(dbPath);
    console.log(`Cleaning DB at: ${dbPath}`);

    // Delete matches that are NOT World Cup matches
    const beforeCount = db.prepare("SELECT COUNT(*) as count FROM matches").get().count;
    const deleteResult = db.prepare("DELETE FROM matches WHERE competition NOT LIKE '%World Cup%'").run();
    const afterCount = db.prepare("SELECT COUNT(*) as count FROM matches").get().count;

    console.log(`  - Deleted ${deleteResult.changes} non-World Cup matches.`);
    console.log(`  - Matches remaining: ${afterCount} (was ${beforeCount}).`);
    db.close();
  } catch (err) {
    console.error(`Error cleaning DB at ${dbPath}:`, err.message);
  }
}
