import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fetch from 'node-fetch'; // if needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.VITE_API_URL || 'https://goal-rush-backend-production.up.railway.app';

app.use(cors({ origin: '*' }));

// 1. Proxy the metadata endpoint to the backend!
// This fixes the blank NFT cards issue since the blockchain has the frontend URL hardcoded.
app.get('/api/metadata/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const backendRes = await fetch(`${BACKEND_URL}/api/metadata/${username}`);
    
    if (!backendRes.ok) {
      return res.status(backendRes.status).send(await backendRes.text());
    }
    
    const data = await backendRes.json();
    res.json(data);
  } catch (err) {
    console.error('Error proxying metadata:', err);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

// 2. Serve static files from the Vite build output directory
app.use(express.static(path.join(__dirname, 'dist')));

// 3. SPA fallback for React router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ GoalRush frontend server running on port ${PORT}`);
});
