# GoalRush Backend — Free Live Football Oracle

A fully free, self-hosted football data backend for your GoalRush prediction platform.  
Runs on Railway. No paid API needed (ESPN data is completely free).

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Railway Server                     │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │
│  │  Fetcher │    │  SQLite  │    │  Express API  │  │
│  │ (ESPN +  │───▶│    DB    │◀───│  REST Routes  │  │
│  │  FD.org) │    │          │    │               │  │
│  └──────────┘    └────┬─────┘    └───────────────┘  │
│       ▲               │                  ▲           │
│  cron 2min       ┌────▼──────┐           │           │
│                  │  Resolver │       Frontend         │
│  cron 3min       │ (ethers)  │     polling every     │
│                  └───────────┘       15 seconds      │
└─────────────────────────────────────────────────────┘
```

**Data sources (all free):**
| Source | Cost | Leagues | Rate |
|--------|------|---------|------|
| ESPN hidden API | FREE, no key | PL, La Liga, Bundesliga, Serie A, Ligue 1, UCL, MLS | Unlimited |
| football-data.org | FREE tier | Same + more | 10 req/min |
| OpenLigaDB | FREE, no key | Bundesliga 1 & 2 | Unlimited |

---

## 🚀 Deploy to Railway (Step by Step)

### 1. Add files to your GitHub repo

Copy the entire `goalrush-backend/` folder into your existing repo:
```
Goal-Rush/
├── backend/          ← copy everything here
│   ├── src/
│   ├── package.json
│   ├── railway.json
│   └── ...
├── frontend/         ← your existing frontend
└── contracts/        ← your existing contracts
```

Or create a **new Railway service** pointing to a separate backend repo.

### 2. Create Railway service

1. Go to [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Select your repo, set **Root Directory** to `backend/`
4. Railway auto-detects Node.js and runs `npm start`

### 3. Add a Volume (persistent SQLite)

1. In Railway dashboard → your service → **Volumes**
2. **Add Volume** → Mount path: `/data`
3. This gives SQLite persistence across deploys

### 4. Set Environment Variables

In Railway dashboard → **Variables**, add:

```
DB_PATH=/data/goalrush.db
FOOTBALL_DATA_KEY=your_key   # free from football-data.org (optional)
ORACLE_PRIVATE_KEY=0x...     # oracle wallet private key
CONTRACT_ADDRESS=0x...       # your GoalRush contract
RPC_URL=https://polygon-rpc.com
ADMIN_SECRET=random_string
```

**Get free football-data.org key:**
1. Go to https://www.football-data.org/client/register
2. Sign up (free)
3. Copy your API key → paste as `FOOTBALL_DATA_KEY`

### 5. Get your Railway URL

After deploy, Railway gives you a URL like:
`https://goalrush-backend-production-xxxx.railway.app`

Copy it.

### 6. Update your frontend

In your frontend `.env` / Vercel dashboard:
```
NEXT_PUBLIC_BACKEND_URL=https://goalrush-backend-production-xxxx.railway.app
```

Drop `frontend-integration/goalrush-api.js` and `useLiveMatches.js` into your frontend `src/lib/`.

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/matches/live` | All live matches right now |
| GET | `/api/matches/upcoming?hours=48` | Upcoming matches |
| GET | `/api/matches/all?limit=100` | All matches |
| GET | `/api/matches/:id` | Single match |
| POST | `/api/matches/refresh` | Force re-fetch |
| GET | `/api/predictions/:wallet` | Wallet's predictions |
| POST | `/api/predictions` | Save prediction after tx |
| POST | `/api/admin/resolve` | Manually resolve match |
| GET | `/api/stats` | DB stats |

---

## 🔗 Smart Contract Auto-Resolution

The resolver watches for `FINISHED` matches and calls `resolveMatch(matchId, result)` on your contract automatically.

**Result enum** (must match your Solidity contract):
```
0 = HOME_WIN
1 = DRAW  
2 = AWAY_WIN
```

**Your contract needs:**
1. An `ORACLE_ROLE` that you grant to your oracle wallet
2. A `resolveMatch(uint256 matchId, uint8 result)` function

**Grant oracle role:**
```solidity
bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
// in your deploy script or admin tx:
contract.grantRole(ORACLE_ROLE, ORACLE_WALLET_ADDRESS);
```

**Linking DB match → on-chain matchId:**
When a match is created on-chain from your frontend, call:
```js
await savePrediction({
  match_id: 'espn_12345',      // backend match id
  wallet: userWallet,
  prediction: 'HOME',
  amount: '0.01',
  tx_hash: tx.hash,
})
```

And separately store `contract_match_id` in the matches table via a POST to your backend (you can add a `/api/matches/:id/link` route).

---

## 🧪 Test Locally

```bash
cd backend
npm install
cp .env.example .env
# Fill in .env values
npm run dev
```

Then visit:
- http://localhost:3001/ — health check
- http://localhost:3001/api/matches/upcoming — upcoming matches
- http://localhost:3001/api/stats — stats

---

## 🆓 Cost: $0

- **Railway Hobby** plan: $5/mo (includes 500 hours free)
- **Data**: ESPN = free, football-data.org free tier = free, OpenLigaDB = free
- **RPC**: Polygon public RPC = free, or Alchemy/Infura free tier
- **SQLite**: no database hosting cost

Total: **Free or $5/mo** depending on Railway plan.
