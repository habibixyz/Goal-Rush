# GoalRush — World Cup Uniswap V4 Hook & Jackpot on X Layer

GoalRush is a gamified Uniswap V4 hook custom-built for the OKX X Layer "Hook the World Cup" Hackathon. It bridges the thrill of World Cup match predictions and penalty shootouts directly into decentralized exchange operations.

![GoalRush Banner](https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80)

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
│   └── mocks/
│       └── MockPoolManager.sol    # Local pool manager simulator
├── scripts/
│   ├── deploy.js                  # Hardhat deployment script for X Layer
│   └── test.js                    # Local test simulation runner
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

### 3. Deploy
Execute the deployment script:
```bash
npx hardhat run scripts/deploy.js --network xlayer
```

---

## 🏆 OKX Hackathon: Eulr.fun Token Launch & Graduation Guide

To participate in the **Build X: World Cup x Hooks** hackathon and qualify for the **$200K USDT prize pool**, we leverage the recommended Eulr.fun launchpad route on X Layer:

### 1. Deploy the Hook Contract on X Layer
First, deploy `WorldCupGoalRushHook` to the X Layer Mainnet using a mined salt that matches the required flags (`beforeSwap` and `afterSwap`). Save the deployed hook address (e.g., `0xb4f86ecb09BE1FeEbc09C2322A67557F145280c0`).

### 2. Launch your Token on Eulr.fun
1. Go to [Eulr.fun](https://eulr.fun/) on the X Layer network.
2. Create your custom World Cup fan token (e.g., `GOAL` or `ARG`).
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
2. Submit your project via the [Official Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfY4MsczrCXsWDM3U_Xo_dEq7dAU04YXZLGhTntiPA2bXL6uQ/viewform?usp=dialog) before the **July 12, 2026** deadline.

