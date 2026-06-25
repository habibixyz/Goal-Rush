const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { fetchAndStoreMatches } = require('./fetcher');
const { resolveFinishedMatches } = require('./resolver');
const db = require('./db');
const routes = require('./routes');
const { runKeeper } = require('./keeper');
const { updateAccessPassPrice } = require('./price-keeper');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Routes ───────────────────────────────────────────────
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'GoalRush Backend Live 🟢', time: new Date().toISOString() });
});

// ─── Cron Jobs ────────────────────────────────────────────
// Fetch upcoming + live matches every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  console.log('[CRON] Fetching matches...');
  await fetchAndStoreMatches();
});

// Resolve finished matches every 3 minutes
cron.schedule('*/3 * * * *', async () => {
  console.log('[CRON] Resolving finished matches...');
  await resolveFinishedMatches();
});

// Run keeper bot to activate matches every 1 minute
cron.schedule('* * * * *', async () => {
  await runKeeper();
});

// Update AccessPass mint price every 10 minutes to keep it at ~$10
cron.schedule('*/10 * * * *', async () => {
  console.log('[CRON] Updating AccessPass mint price...');
  await updateAccessPassPrice();
});

// ─── Boot ─────────────────────────────────────────────────
async function boot() {
  await db.init();
  await fetchAndStoreMatches(); // immediate first fetch
  app.listen(PORT, () => {
    console.log(`✅ GoalRush backend running on port ${PORT}`);
  });
}

boot().catch(console.error);
