const path = require('path');
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
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────
async function configureX402Payments(app) {
  const enabled = process.env.X402_ENABLED !== 'false';
  if (!enabled) {
    console.warn('[x402] Payment protection disabled by X402_ENABLED=false');
    return;
  }

  // Real OKX Agentic Wallet address on X Layer (chain 196)
  const payTo = process.env.X402_RECEIVER_ADDRESS || '0xd96c9899b4d48c02efbd88dc22252a60dc6ee38d';
  const network = process.env.X402_NETWORK || 'eip155:196';
  // Official USDT0 contract on X Layer mainnet
  const asset = process.env.X402_ASSET || '0x779ded0c9e1022225f8e0630b35a9b54be713736';
  const price = process.env.X402_PRICE || '0.005';
  const facilitatorUrl = process.env.X402_FACILITATOR_URL || 'https://facilitator.payai.network';

  try {
    const { paymentMiddleware, x402ResourceServer } = await import('@x402/express');
    const { HTTPFacilitatorClient } = await import('@x402/core/server');
    const { ExactEvmScheme } = await import('@x402/evm/exact/server');

    const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
    const evmScheme = new ExactEvmScheme();
    evmScheme.registerMoneyParser(async (amount, net) => {
      if (net === 'eip155:196' || net === 'eip155:1952') {
        const decimals = 6; // USDT has 6 decimals
        const tokenAmount = (amount * Math.pow(10, decimals)).toFixed(0);
        return {
          amount: tokenAmount,
          asset: asset,
          extra: {
            name: 'USD₮0',
            version: '1',
            assetTransferMethod: 'permit2'
          }
        };
      }
      return null;
    });

    const resourceServer = new x402ResourceServer(facilitatorClient)
      .register(network, evmScheme);

    app.use(paymentMiddleware(
      {
        'POST /api/predict': {
          accepts: [
            {
              scheme: 'exact',
              price,
              network,
              asset,
              payTo
            }
          ],
          description: 'GoalRush consensus soccer match prediction — OKX.AI ASP #4564.',
          mimeType: 'application/json'
        }
      },
      resourceServer
    ));

    console.log(`[x402] Protecting POST /api/predict — network=${network} asset=${asset} price=${price} payTo=${payTo}`);
  } catch (err) {
    console.error('[x402] Failed to initialize payment middleware:', err.message);
    console.error('[x402] The /api/predict endpoint will NOT be payment-protected.');
  }
}

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

  // Start on-chain keeper (auto-activates & resolves matches on X Layer)
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
