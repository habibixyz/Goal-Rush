const express = require('express');
const router = express.Router();
const db = require('./db');
const { fetchAndStoreMatches, fetchWorldCupNews } = require('./fetcher');
const { resolveMatchManually } = require('./resolver');

// ── GET /api/matches/live ─────────────────────────────────
router.get('/matches/live', (req, res) => {
  try {
    const matches = db.getLiveMatches();
    res.json({ success: true, data: matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/matches/upcoming ─────────────────────────────
router.get('/matches/upcoming', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 48;
    const matches = db.getUpcomingMatches(hours);
    res.json({ success: true, data: matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/matches/all ──────────────────────────────────
router.get('/matches/all', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const matches = db.getAllMatches(limit);
    res.json({ success: true, data: matches, count: matches.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/matches/:id ──────────────────────────────────
router.get('/matches/:id', (req, res) => {
  try {
    const match = db.getMatchById(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/matches/refresh ─────────────────────────────
// Force an immediate data fetch (useful for admin / frontend trigger)
router.post('/matches/refresh', async (req, res) => {
  try {
    await fetchAndStoreMatches();
    res.json({ success: true, message: 'Matches refreshed' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/predictions/:wallet ─────────────────────────
router.get('/predictions/:wallet', (req, res) => {
  try {
    const predictions = db.getPredictionsByWallet(req.params.wallet.toLowerCase());
    res.json({ success: true, data: predictions });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/predictions ─────────────────────────────────
// Called from your frontend after a successful on-chain tx
router.post('/predictions', (req, res) => {
  try {
    const { match_id, wallet, prediction, amount, tx_hash } = req.body;
    if (!match_id || !wallet || !prediction || !amount) {
      return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    db.savePrediction({
      match_id,
      wallet: wallet.toLowerCase(),
      prediction: prediction.toUpperCase(),
      amount: String(amount),
      tx_hash: tx_hash || null,
    });
    res.json({ success: true, message: 'Prediction saved' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/admin/resolve ───────────────────────────────
// Manual resolution (protect this with ADMIN_SECRET env var)
router.post('/admin/resolve', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const { contract_match_id, home_score, away_score } = req.body;
    const txHash = await resolveMatchManually(contract_match_id, home_score, away_score);
    res.json({ success: true, tx_hash: txHash });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/stats ────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const dbRaw = db.getDb();
    const live = dbRaw.prepare("SELECT COUNT(*) as c FROM matches WHERE status='LIVE'").get().c;
    const upcoming = dbRaw.prepare("SELECT COUNT(*) as c FROM matches WHERE status='SCHEDULED'").get().c;
    const finished = dbRaw.prepare("SELECT COUNT(*) as c FROM matches WHERE status='FINISHED'").get().c;
    const predictions = dbRaw.prepare("SELECT COUNT(*) as c FROM predictions").get().c;
    res.json({ success: true, data: { live, upcoming, finished, predictions } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/cards ────────────────────────────────────────
router.get('/cards', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const cards = db.getRecentTwitterCards(limit);
    res.json({ success: true, data: cards });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/metadata/:username ───────────────────────────
router.get('/metadata/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    // We need a specific DB query to find the card by username
    const dbRaw = db.getDb();
    let card = dbRaw.prepare('SELECT * FROM twitter_cards WHERE LOWER(username) = LOWER(?) COLLATE NOCASE OR LOWER(username) = LOWER(?) COLLATE NOCASE').get(username, '@' + username);
    
    if (!card) {
      console.log(`Card ${username} not found in local DB. Querying blockchain fallback...`);
      // Fallback: Query the blockchain directly if DB was reset
      const { ethers } = require('ethers');
      const provider = new ethers.JsonRpcProvider('https://xlayerrpc.okx.com');
      const nftAddress = '0xd30b894bbD3185737c5D6a276367A4fEDF44de5C';
      const nftAbi = [
        "function nextTokenId() view returns (uint256)",
        "function getCard(uint256 tokenId) view returns (tuple(string username, string pos, uint8 overall, uint8 defi_iq, uint8 prediction_power, uint8 jackpot_luck, uint8 degen_level, uint8 swap_speed, uint8 x_factor, string card_type, uint256 mintTime))"
      ];
      const contract = new ethers.Contract(nftAddress, nftAbi, provider);
      
      const nextId = await contract.nextTokenId();
      for (let i = 1n; i < nextId; i++) {
        try {
          const onchainCard = await contract.getCard(i);
          const cleanOnchainUser = onchainCard.username.replace('@', '').toLowerCase();
          const cleanSearchUser = username.replace('@', '').toLowerCase();
          
          if (cleanOnchainUser === cleanSearchUser) {
            card = {
              username: onchainCard.username,
              position: onchainCard.pos,
              overall: Number(onchainCard.overall),
              defi_iq: Number(onchainCard.defi_iq),
              prediction_power: Number(onchainCard.prediction_power),
              jackpot_luck: Number(onchainCard.jackpot_luck),
              degen_level: Number(onchainCard.degen_level),
              swap_speed: Number(onchainCard.swap_speed),
              x_factor: Number(onchainCard.x_factor),
              card_type: onchainCard.card_type
            };
            break;
          }
        } catch (err) {
          continue;
        }
      }
      
      if (!card) {
        return res.status(404).json({ error: 'Card not found on-chain or in database' });
      }
    }

    // Generate a simple but aesthetic SVG representing the player card
    const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1a1c29" />
          <stop offset="100%" stop-color="#0f1015" />
        </linearGradient>
        <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${card.card_type === 'legendary' ? '#ffaa00' : card.card_type === 'diamond' ? '#00e5ff' : '#ffd700'}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" rx="20" />
      <rect width="100%" height="100%" fill="url(#glow)" rx="20" />
      <rect x="10" y="10" width="380" height="580" fill="none" stroke="${card.card_type === 'legendary' ? '#ffaa00' : '#ffd700'}" stroke-width="4" rx="15" />
      
      <text x="50" y="100" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="#ffffff">${card.overall}</text>
      <text x="50" y="140" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="${card.card_type === 'legendary' ? '#ffaa00' : '#ffd700'}">${card.position}</text>
      
      <circle cx="200" cy="250" r="80" fill="#2a2d3d" stroke="${card.card_type === 'legendary' ? '#ffaa00' : '#ffd700'}" stroke-width="4"/>
      
      <text x="200" y="400" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#ffffff" text-anchor="middle">${card.username}</text>
      
      <text x="70" y="460" font-family="Arial, sans-serif" font-size="20" fill="#aaaaaa">DeFi IQ: <tspan fill="#ffffff" font-weight="bold">${card.defi_iq}</tspan></text>
      <text x="230" y="460" font-family="Arial, sans-serif" font-size="20" fill="#aaaaaa">Degen: <tspan fill="#ffffff" font-weight="bold">${card.degen_level}</tspan></text>
      
      <text x="70" y="500" font-family="Arial, sans-serif" font-size="20" fill="#aaaaaa">Predict: <tspan fill="#ffffff" font-weight="bold">${card.prediction_power}</tspan></text>
      <text x="230" y="500" font-family="Arial, sans-serif" font-size="20" fill="#aaaaaa">Speed: <tspan fill="#ffffff" font-weight="bold">${card.swap_speed}</tspan></text>
      
      <text x="200" y="560" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${card.card_type === 'legendary' ? '#ffaa00' : '#ffd700'}" text-anchor="middle">${card.card_type.toUpperCase()}</text>
    </svg>`;

    const base64Svg = Buffer.from(svgString).toString('base64');
    const imageUri = `data:image/svg+xml;base64,${base64Svg}`;

    // Return ERC-721 metadata standard JSON
    const metadata = {
      name: `GoalRush Player: ${card.username}`,
      description: `Official GoalRush Degen World Cup Collectible for ${card.username}. Position: ${card.position}. OVR: ${card.overall}.`,
      image: imageUri,
      attributes: [
        { trait_type: 'Position', value: card.position },
        { trait_type: 'Overall', value: card.overall },
        { trait_type: 'DeFi IQ', value: card.defi_iq },
        { trait_type: 'Prediction Power', value: card.prediction_power },
        { trait_type: 'Jackpot Luck', value: card.jackpot_luck },
        { trait_type: 'Degen Level', value: card.degen_level },
        { trait_type: 'Swap Speed', value: card.swap_speed },
        { trait_type: 'X-Factor', value: card.x_factor },
        { trait_type: 'Card Type', value: card.card_type }
      ]
    };

    res.json(metadata);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/cards ───────────────────────────────────────
router.post('/cards', (req, res) => {
  try {
    const {
      wallet,
      username,
      avatar_url,
      position,
      overall,
      defi_iq,
      prediction_power,
      jackpot_luck,
      degen_level,
      swap_speed,
      x_factor,
      card_type,
      tx_hash
    } = req.body;

    if (!wallet || !username || !position || !overall) {
      return res.status(400).json({ success: false, error: 'Missing required card fields' });
    }

    db.saveTwitterCard({
      wallet,
      username,
      avatar_url,
      position,
      overall: parseInt(overall),
      defi_iq: parseInt(defi_iq || 0),
      prediction_power: parseInt(prediction_power || 0),
      jackpot_luck: parseInt(jackpot_luck || 0),
      degen_level: parseInt(degen_level || 0),
      swap_speed: parseInt(swap_speed || 0),
      x_factor: parseInt(x_factor || 0),
      card_type,
      tx_hash: tx_hash || null
    });

    res.json({ success: true, message: 'Twitter card saved successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/news ─────────────────────────────────────────
router.get('/news', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category || null;
    const articles = db.getNewsArticles(limit, category);
    res.json({ success: true, data: articles });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/news/:id/like ────────────────────────────────
router.post('/news/:id/like', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.likeNewsArticle(id);
    res.json({ success: true, message: 'Article liked successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/news/ingest ─────────────────────────────────
router.post('/news/ingest', async (req, res) => {
  try {
    const logs = [];
    logs.push(`[${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' })} ET] > Initializing Web3 Oracle Connection...`);
    logs.push(`[${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' })} ET] > Crawlee Crawler connected to Sky Sports Football...`);
    
    await fetchWorldCupNews();
    
    logs.push(`[${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' })} ET] > Crawlee parsing completed. DB upserted latest coverage.`);
    logs.push(`[${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'America/New_York' })} ET] > Oracle synchronization success!`);
    
    res.json({
      success: true,
      message: 'Ingestion completed successfully.',
      logs
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
