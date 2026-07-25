async function configureX402Payments(app) {
  const enabled = process.env.X402_ENABLED !== 'false';
  if (!enabled) {
    console.warn('[x402] Payment protection disabled by X402_ENABLED=false');
    return;
  }

  const payTo = process.env.X402_RECEIVER_ADDRESS || '0xd96c9899b4d48c02efbd88dc22252a60dc6ee38d';
  const network = process.env.X402_NETWORK || 'eip155:196';
  const asset = process.env.X402_ASSET || '0x1E4a5963aBFD975d8c9021ce480b42188849D41d';
  const price = process.env.X402_PRICE || '0.005';

  try {
    const { paymentMiddleware, x402ResourceServer } = require('@okxweb3/x402-express');
    const { OkxFacilitatorClient } = require('@okxweb3/x402-core');
    const { ExactEvmScheme } = require('@okxweb3/x402-evm/exact/server');

    console.log('[x402] Instantiating OkxFacilitatorClient with credentials...');
    const facilitatorClient = new OkxFacilitatorClient({
      apiKey: process.env.OKX_API_KEY,
      secretKey: process.env.OKX_SECRET_KEY,
      passphrase: process.env.OKX_PASSPHRASE
    });

    const evmScheme = new ExactEvmScheme();
    evmScheme.registerMoneyParser(async (amount, net) => {
      if (net === 'eip155:4663' || net === 'eip155:196' || net === 'eip155:1952') {
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

    // Bypass A2A chat and platform pings so they don't trigger x402 Payment Required
    app.use('/api/predict', (req, res, next) => {
      const isA2A = req.body?.msgType === 'a2a-agent-chat' || req.body?.message?.source === 'system';
      const isTest = req.body?.test === true || req.query?.test === 'true';
      const isPing = req.body?.ping || req.query?.ping;

      if (isA2A || isTest || isPing) {
        console.log(`[x402 Bypass] Intercepted platform/A2A request: isA2A=${isA2A}, isTest=${isTest}, isPing=${isPing}`);
        return res.json({
          response: "GoalRush Football Agent is online! To predict a match, please use the A2MCP endpoint with standard x402 payment headers. (A2A test successful)",
          success: true,
          service: "GoalRush Consensus Soccer Prediction Swarm (ASP #4564)",
          message: "A2A Endpoint reachable. Service is healthy and ready to accept tasks.",
          timestamp: new Date().toISOString()
        });
      }
      next();
    });

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
          description: 'GoalRush consensus soccer match prediction — GoalRush ASP #4564.',
          mimeType: 'application/json'
        },
        'GET /api/predict': {
          accepts: [
            {
              scheme: 'exact',
              price,
              network,
              asset,
              payTo
            }
          ],
          description: 'GoalRush consensus soccer match prediction — GoalRush ASP #4564.',
          mimeType: 'application/json'
        }
      },
      resourceServer
    ));

    console.log(`[x402] Protecting GET & POST /api/predict — network=${network} asset=${asset} price=${price} payTo=${payTo}`);
  } catch (err) {
    console.error('[x402] Failed to initialize payment middleware:', err.message, err.stack);
    console.error('[x402] The /api/predict endpoint will NOT be payment-protected.');
  }
}

module.exports = { configureX402Payments };
