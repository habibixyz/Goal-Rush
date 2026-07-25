# GoalRush — Tournament Uniswap V4 Hook & Jackpot on OKX X Layer

**🌐 Live Demo:** [goalrush.fun](https://goalrush.fun)

GoalRush is a gamified Uniswap V4 hook custom-built for the OKX X Layer Mainnet. It bridges the thrill of Tournament match predictions and penalty shootouts directly into decentralized exchange operations.

![GoalRush Banner](https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80)

---

## 🚀 Active Deployment Addresses (OKX X Layer Mainnet)

* **GoalRush Hook v2**: `0x737b827dF98aC380C447dC54aCcDF415B01DB6a6` (with 2% platform fee)
* **GoalRush Router v2**: `0xbd2386017d075CC6031195ad623e3E923bb1FCFf` (with batch support)
* **Owner Wallet**: `0xAe1B810fFB88855fFD967Dc274D9ba4fadd21990`

---

## 🤖 Keeper Bot Management (PM2)

The GoalRush Keeper Bot automates on-chain match activation (5 minutes before kickoff) and resolution (when ESPN scoreboard status changes to full-time). It runs 24/7 in the background via PM2.

### Start Keeper Bot
```bash
npx pm2 start ecosystem.config.cjs
```

### Check Logs
```bash
npx pm2 logs goalrush-keeper
```

### Restart Keeper Bot
```bash
npx pm2 restart goalrush-keeper
```

---

## 🧠 Autonomous Multi-Agent Consensus Swarm (Sentient Grant Edition)

GoalRush acts as the execution sandbox for an **Autonomous Multi-Agent Consensus Swarm** built to interact safely with decentralized prediction markets. The agent showcases a "Hard Boundary" security architecture and a "Mixture of Agents" consensus model, proving that open-source LLMs can securely operate on-chain without exposing private keys to prompt-injection vulnerabilities.

### How the Sentient Swarm Agent Works
1. **Event-Driven Triggering:** The agent is event-driven. The **Keeper Bot** triggers the Swarm Agent immediately upon match registration/activation (kick-off ≤ 5 minutes away) and match resolution.
2. **Context Ingestion:** The Swarm Agent reads the latest scraped soccer news articles and match schedules from the SQLite database to build a rich historical and current context.
3. **Multi-Agent Consensus (Mixture of Agents):** The agent queries **three independent open-source models** simultaneously:
   - `llama-3.1-8b-instant`
   - `llama-3.3-70b-versatile`
   - `qwen/qwen3-32b`
4. **Reasoning Verification:** Each model acts as an independent analyst, responding strictly with a JSON object containing its prediction (`1` for Home, `2` for Away, `3` for Draw) and a 1-sentence analytical `reasoning`.
5. **Hard Boundary Execution:** The Executive Agent tallies the votes. It enforces a strict, hardcoded betting limit (e.g., `0.0001 OKB` per prediction) and parses the JSON. A transaction is only signed and sent if a 2/3 majority consensus (quorum) is successfully reached. The AI models *never* have access to the wallet private key or direct payload construction, keeping the wallet safe from prompt injection attacks.
6. **Live Oracle Terminal:** The frontend features an "X LAYER SPORTS ORACLE SYSTEM" that streams the Swarm's internal logs in real-time.

---

### ⚙️ How to Deploy & Set Up the Agent Swarm

If you or another user want to run this agent, follow these steps:

#### 1. Setup Environment Variables
Configure your hosting platform (e.g., Railway variables) or local `.env` with the following variables:
* `PRIVATE_KEY`: Private key of the EVM wallet that will pay for predictions and gas (must be funded with OKB on X Layer).
* `GROQ_API_KEY`: API key from Groq to query the LLMs.
* `XLAYER_MAINNET_RPC`: Mainnet RPC URL (`https://rpc.xlayer.tech`).
* `HOOK_ADDRESS`: The deployed GoalRush hook contract address.
* `ROUTER_ADDRESS`: The prediction router address.

#### 2. Run the Swarm Agent Locally
```bash
# Run once to process pending claims and predict on active matches
node backend/src/goalrush-ai-agent.cjs
```
*(Note: The agent is automatically spawned by PM2 or Railway when starting the backend server).*

---

## ⚽ Core Innovation

In Uniswap V4, hooks can run arbitrary logic before and after pool transactions. GoalRush utilizes this capability to create two unique mechanisms for Tournament fans:

1. **Tournament Match Jackpot Pool (`beforeSwap`)**:
   - Swappers can specify their predicted winning team (e.g., Argentina 🇦🇷 or France 🇫🇷) inside the `bytes hookData` payload of their swaps.
   - For every swap, the hook diverts **0.1% of the swap volume** into the match's jackpot pool.
   - The hook records the swapper's address, prediction, and transaction volume.
   - When the match resolves (via an owner/oracle transaction), the accumulated jackpot pool is split among swappers who predicted correctly, proportional to their swap volumes.

2. **Goal Rush Fee Rebate (`afterSwap`)**:
   - Every swap has a pseudo-random **5% chance** of scoring a "Goal" (calculated using gas, transaction parameters, and block entropy).
   - If a swapper scores a Goal, they receive a **100% fee refund/rebate** directly back to their wallet, creating a gamified "Penalty Strike" experience for active traders.

---

## 🛠️ Tech Stack & Directory Structure

```
hook-the-world-cup/
├── contracts/
│   ├── WorldCupGoalRushHook.sol   # Solidity hook contract
│   ├── GoalRushToken.sol          # Standalone GRUSH ERC-20 token contract
│   └── mocks/
│       └── MockPoolManager.sol    # Local pool manager simulator
├── scripts/
│   ├── deploy.cjs                 # Hardhat deployment script for Hook on X Layer
│   ├── deploy-token.cjs           # Hardhat deployment script for GRUSH token
│   └── test.cjs                   # Local test simulation runner
├── src/
│   ├── main.jsx                   # React application entry point
│   ├── App.jsx                    # Futuristic soccer-themed landing page & sandbox
│   └── style.css                  # Custom premium styling variables and pitch layout
├── package.json                   # Project packages
├── vite.config.js                 # Vite compilation configuration
└── index.html                     # HTML shell & web SEO meta-tags
```

---

## 🚀 Getting Started & Running Locally

Follow these steps to run the interactive dashboard locally:

### 1. Install Dependencies
Run from the root of the project:
```bash
npm install
```

### 2. Run the Development Server
GoalRush includes a unified dev runner script that starts both the Vite frontend client and the Express backend server concurrently:
```bash
npm run dev
```
- **Frontend URL**: `http://localhost:5173` (or `http://localhost:5174` if port is in use)
- **Backend URL**: `http://localhost:3001` (Express API & Socket.io server)

---

## 🤖 OKX.AI Onchain OS Integration & Payments Protocol Compliance

GoalRush is integrated with the official OKX Agentic Wallet, Agent Service Provider (ASP) standards, and the OKX Agent Payments Protocol (x402).

### 1. ASP Identity & Listing Status
* **Agent ID**: `#4564`
* **Name**: `GoalRush`
* **Role**: `Agent Service Provider (ASP)`
* **Status**: `Listing under review` (Resubmitted with verified payments integration)
* **Owner Wallet Address**: `0xd96c9899b4d48c02efbd88dc22252a60dc6ee38d`

### 2. OKX Agent Payments Protocol (x402) Integration
The `/api/predict` route handler is protected by the official `@x402/express` middleware. When queried directly, it issues an HTTP 402 challenge requesting payment:
* **Asset/Token**: `USDT` on X Layer Mainnet (`eip155:196`)
* **Service Fee**: `0.005` USDT (represented as `5000` micro-units)
* **Contract/Asset Address**: `0x1E4a5963aBFD975d8c9021ce480b42188849D41d`
* **Default Facilitator**: `https://facilitator.payai.network`
* **Live Endpoint**: `https://goal-rush-backend-production.up.railway.app/api/predict`

### 3. UX Real-Time Sync & Auto-Transitioning
* **15-Second Sync Interval**: REST polling continuously syncs real-world score updates (`scoreA`, `scoreB`), minute displays, and status flags alongside WebSocket event feeds.
* **Auto-Transitioning**: When an active match finishes (`FT` / `resolved`), the UI automatically transitions to the next upcoming match object to ensure uninterrupted player engagement.

### 4. Code Quality & Security Standards
* **Linting & Formatting**: Enforced via ESLint (`.eslintrc.cjs`) and Prettier (`.prettierrc`) with automated scripts `npm run lint` and `npm run format`.
* **Resilience & Fault Tolerance**: Express backend includes a global uncaught exception error handler preventing process crashes, and modularized x402 payment validation logic (`backend/src/x402-config.js`).

---

## 🌐 Deploying to OKX X Layer

To deploy the `WorldCupGoalRushHook` contract onto the OKX X Layer:

### 1. Set Up RPC Configurations
Configure your Hardhat network parameters:
- **Network Name**: X Layer Mainnet / Testnet
- **RPC URL**: `https://rpc.xlayer.tech` (Mainnet) or `https://testrpc.xlayer.tech` (Testnet)
- **Chain ID**: `196` (Mainnet) or `195` (Testnet)
- **Gas Token**: OKB

### 2. Hook Address Mining
Uniswap V4 hooks rely on the leading flags of the hook address to determine which callbacks to trigger. In our case, the address must have prefix bits matching the `BEFORE_SWAP_FLAG` and `AFTER_SWAP_FLAG`. Use a hook miner to find a matching salt:
```bash
# Mine CREATE2 address prefix salt matching 0x80 (beforeSwap) and 0x40 (afterSwap)
npx hardhat run scripts/mine-salt.js
```

### 3. Deploy Hook
Execute the deployment script:
```bash
npx hardhat run scripts/deploy.cjs --network xlayer
```

### 4. Deploy standalone GRUSH token (Optional fallback)
Execute the token deployment script:
```bash
npx hardhat run scripts/deploy-token.cjs --network xlayer
```
