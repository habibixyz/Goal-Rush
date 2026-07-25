const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { fetchAndStoreMatches, fetchWorldCupNews } = require('./fetcher');
const { resolveFinishedMatches } = require('./resolver');
const { startKeeper } = require('./keeper');
const db = require('./db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', true);
app.use(cors({
  origin: '*',
  exposedHeaders: ['PAYMENT-REQUIRED', 'WWW-Authenticate'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-PAYMENT', 'PAYMENT-SIGNATURE', 'x-api-key', 'x-admin-secret']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../../public')));

app.get('/access-pass.png', (req, res) => {
  const candidates = [
    path.join(__dirname, '../public/access-pass.png'),
    path.join(__dirname, 'public/access-pass.png'),
    path.join(__dirname, '../../public/access-pass.png'),
    path.join(process.cwd(), 'public/access-pass.png'),
    path.join(process.cwd(), 'backend/public/access-pass.png')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return res.sendFile(c);
    }
  }
  res.status(404).send('Image not found');
});

const { configureX402Payments } = require('./x402-config');

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

// Fetch latest news from Sky Sports and ESPN every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('[CRON] Auto-syncing news from sports platforms...');
  await fetchWorldCupNews();
});

// ─── Boot ─────────────────────────────────────────────────
async function boot() {
  await db.init();
  await configureX402Payments(app);
  app.use('/api', routes);

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.message, err.stack);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  });

  // Start on-chain keeper (auto-activates & resolves matches on X Layer Mainnet)
  startKeeper(cron);

  // Start the GoalRush Open AGI Agent
  require('./goalrush-ai-agent.cjs');

  app.listen(PORT, () => {
    console.log(`✅ GoalRush backend running on port ${PORT}`);
    
    // Run fetches asynchronously in the background so boot is not blocked
    fetchAndStoreMatches().catch(err => console.error('[BOOT FETCH MATCHES ERR]', err.message));
    fetchWorldCupNews().catch(err => console.error('[BOOT FETCH NEWS ERR]', err.message));
  });
}

boot().catch(console.error);
