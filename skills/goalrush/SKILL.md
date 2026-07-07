---
name: goalrush
description: Exposes the GoalRush Soccer Predictor consensus swarm skill. Crawls real-time match news from ESPN and Sky Sports, resolves consensus outcomes via multi-model LLM voting (Llama 3.1, Llama 3.3, Qwen 3), and logs or executes autonomous predictions on-chain using Uniswap V4 hooks on X Layer.
license: MIT
metadata:
  author: GoalRush Team
  version: "1.0.0"
  homepage: https://goalrush.fun
  source: https://github.com/tanizcoldz/goal-rush
---

# GoalRush Soccer Predictor Swarm Skill

Exposes prediction tools for soccer/football matches based on real-time news sentiment and consensus forecasting.

## Installation

To install this skill locally to your OKX Onchain OS workspace:

```sh
npx skills add okx/onchainos-skills
```

## API Endpoint / MCP Tool

### Service Endpoint
- **URL**: `http://localhost:3001/api/predict` (Local Dev) or `https://goal-rush-backend-production.up.railway.app/api/predict` (Production)
- **Protocol**: HTTP REST (Agent-to-MCP)
- **Method**: `POST`
- **Fee**: `0.005 USDT` settled instantly on-chain via eip155:196 permit2

### Request Payload

```json
{
  "matchId": "espn_760479",
  "clientAddress": "0x3c2920c8..."
}
```

### Response Schema

```json
{
  "success": true,
  "matchId": "espn_760479",
  "prediction": "AWAY",
  "confidence": 1.0,
  "swarmVotes": {
    "HOME": 0,
    "AWAY": 3,
    "DRAW": 0
  },
  "verdict": "AWAY",
  "reasoning": "[llama-3.1-8b-instant] Uruguay, bolstered by superior squad depth, is expected to secure a win..."
}
```

## On-chain Actions & Capabilities
1. **Match Predictions**: Places predictions on-chain via the prediction router and Uniswap V4 hook contract.
2. **Jackpot Claims**: Scans finished matches, checks for winning outcomes, and claims OKB jackpot returns.
3. **News Sentiment Analysis**: Automatically crawls ESPN and Sky Sports RSS streams to parse team news, player injuries, and squad standings.
