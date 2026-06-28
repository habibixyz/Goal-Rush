# GoalRush — World Cup Uniswap V4 Hook & Jackpot on X Layer

**🌐 Live Demo:** [goalrush.fun](https://goalrush.fun)

GoalRush is a gamified Uniswap V4 hook custom-built for the OKX X Layer "Hook the World Cup" Hackathon. It bridges the thrill of World Cup match predictions and penalty shootouts directly into decentralized exchange operations.

![GoalRush Banner](https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80)

---

## 🚀 Active Deployment Addresses (X Layer Mainnet)

* **GoalRush Hook**: `0x700656337a252A004Ca0B170828f4adEaa680288`
* **GoalRush Router**: `0x8f3e9B45a377cEa9fCeC9509e82EEe237e67ba24`
* **GRUSH Token**: `0x422fe165b2da990d18c6dca944b11dcd61519671`

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

## 🧠 Autonomous Multi-Agent Consensus Swarm (Sentient Grant Edition)

GoalRush acts as the execution sandbox for an **Autonomous Multi-Agent Consensus Swarm** built to interact safely with decentralized prediction markets. The agent showcases a "Hard Boundary" security architecture and a "Mixture of Agents" consensus model, proving that open-source LLMs can securely operate on-chain without exposing private keys to prompt-injection vulnerabilities.

### How the Sentient Swarm Agent Works
1. **Event-Driven Triggering:** The agent is no longer polling on an interval. Instead, it is event-driven. The **Keeper Bot** triggers the Swarm Agent immediately upon match registration/activation ( kick-off ≤ 5 minutes away) and match resolution.
2. **Context Ingestion:** The Swarm Agent reads the latest scraped soccer news articles and match schedules from the SQLite database to build a rich historical and current context.
3. **Multi-Agent Consensus (Mixture of Agents):** The agent queries **three independent open-source models** simultaneously:
   - `llama-3.1-8b-instant`
   - `llama-3.3-70b-versatile`
   - `qwen/qwen3-32b`
4. **Reasoning Verification:** Each model acts as an independent analyst, responding strictly with a JSON object containing its prediction (`1` for Home, `2` for Away, `3` for Draw) and a 1-sentence analytical `reasoning`.
5. **Hard Boundary Execution:** The Executive Agent tallies the votes. It enforces a strict, hardcoded betting limit (e.g., `0.0001 OKB` per prediction) and parses the JSON. A transaction is only signed and sent if a 2/3 majority consensus (quorum) is successfully reached. The AI models *never* have access to the wallet private key or the direct construction of the transaction payload, keeping the wallet safe from prompt injection attacks.
6. **Live Oracle Terminal:** The frontend features an "X LAYER SPORTS ORACLE SYSTEM" that streams the Swarm's internal logs in real-time.

---

### ⚙️ How to Deploy & Set Up the Agent Swarm

If you or another user want to run this agent, follow these steps:

#### 1. Setup Environment Variables
Configure your hosting platform (e.g., Railway variables) or local `.env` with the following variables:
* `PRIVATE_KEY`: Private key of the EVM wallet that will pay for predictions and gas (must be funded with OKB on X Layer).
* `GROQ_API_KEY`: API key from Groq to query the LLMs.
* `XLAYER_MAINNET_RPC`: Mainnet RPC URL (`https://xlayerrpc.okx.com` or `https://rpc.xlayer.tech`).
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

In Uniswap V4, hooks can run arbitrary logic before and after pool transactions. GoalRush utilizes this capability to create two unique mechanisms for World Cup fans:

1. **World Cup Match Jackpot Pool (`beforeSwap`)**:
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
Start the local server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the interactive soccer pitch swap dashboard.

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

---

## 🏆 OKX Hackathon: Eulr.fun Token Launch & Graduation Guide

To participate in the **Build X: World Cup x Hooks** hackathon and qualify for the **$200K USDT prize pool**, we leverage the recommended Eulr.fun launchpad route on X Layer:

### 1. Deploy the Hook Contract on X Layer
First, deploy `WorldCupGoalRushHook` to the X Layer Mainnet using a mined salt that matches the required flags (`beforeSwap` and `afterSwap`). Save the deployed hook address (e.g., `0xD168C19fA2c8b52b8024209B4e3E4Eaf69cD40c0`).

### 2. Launch your Token on Eulr.fun
1. Go to [Eulr.fun](https://eulr.fun/) on the X Layer network.
2. Create your custom World Cup fan token (e.g., `GRUSH`).
3. During token creation, specify your deployed `WorldCupGoalRushHook` address as the target hook to be attached to the Uniswap V4 pool upon graduation.

### 3. Bonding Curve Trading
Users buy and sell your token on the Eulr.fun bonding curve. This builds initial hype, community, and volume. *(Note: Bonding curve volume does not count towards the $200k prize pool).*

### 4. Graduation & Real Trading on Uniswap V4
Once the bonding curve hits the threshold:
1. Eulr.fun ends the bonding curve automatically.
2. It deploys a Uniswap V4 pool on X Layer with your pre-configured `WorldCupGoalRushHook`.
3. It moves all gathered liquidity into the pool.
4. **Real trading starts!** 

### 5. Drive OKX Wallet Trading Volume
From this point on, all swaps on the Uniswap V4 pool will execute with the `WorldCupGoalRushHook` active:
* Every swap diverts 0.1% volume to the match jackpot.
* Every swap triggers the Goal Rush rebate chance.
* **CRITICAL**: Only trading volume routed through the **OKX Wallet** on your graduated Uniswap V4 pool counts towards the ranking for the $200K USDT prize pool.

### 6. Submit Your Project
1. Share your project on X (Twitter) tagging `@XLayerOfficial`.
2. Submit your project via the [Official Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfY4MsczrCXsWDM3U_Xo_dEq7dAU04YXZLGhTntiPA2bXL6uQ/viewform?usp=dialog) before the deadline.
