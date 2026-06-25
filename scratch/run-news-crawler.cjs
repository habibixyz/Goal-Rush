const { fetchWorldCupNews } = require('../backend/src/fetcher');
const dbModule = require('../backend/src/db');
const Database = require('../backend/node_modules/better-sqlite3');
const path = require('path');

async function main() {
  console.log("Initializing database...");
  await dbModule.init();
  
  console.log("Running fetchWorldCupNews...");
  try {
    await fetchWorldCupNews();
    console.log("Crawler successfully completed run.");

    // Query DB
    const DB_PATH = path.join(__dirname, '../backend/data/goalrush.db');
    const db = new Database(DB_PATH);
    const news = db.prepare("SELECT * FROM news ORDER BY published_at DESC").all();
    console.log(`\nFound ${news.length} news articles in database:\n`);
    news.forEach(n => {
      console.log(`- ID: ${n.id} | [${n.category}] ${n.title}`);
      console.log(`  Source: ${n.source} | URL: ${n.url}`);
      console.log(`  Summary: ${n.summary}\n`);
    });
    db.close();
  } catch (err) {
    console.error("Error running crawler or querying database:", err);
  }
}

main();
