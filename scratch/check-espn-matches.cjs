const https = require("https");
const { ethers } = require("hardhat");

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON parse error: ' + body.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

async function fetchESPN() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');

  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
  const ty = tomorrow.getUTCFullYear();
  const tm = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const td = String(tomorrow.getUTCDate()).padStart(2, '0');

  const start = `${y}${m}${d}`;
  const end   = `${ty}${tm}${td}`;

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${start}-${end}`;
  console.log("Fetching ESPN URL:", url);
  const data = await httpGet(url);
  return data.events || [];
}

function espnIdToOnChain(espnId) {
  return BigInt(ethers.keccak256(ethers.toUtf8Bytes(`espn_${espnId}`)));
}

async function main() {
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  const hook = await ethers.getContractAt([
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ], hookAddress);

  const activeId = await hook.activeMatchId();
  console.log("Active Match ID on Hook:", activeId.toString());

  const events = await fetchESPN();
  console.log(`Found ${events.length} events in ESPN feed.\n`);

  for (const event of events) {
    const espnId = event.id;
    const matchName = event.name || espnId;
    const status = event.status?.type?.name || '';
    const comps = event.competitions?.[0];
    const competitors = comps?.competitors || [];
    const home = competitors.find(c => c.homeAway === 'home');
    const away = competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const teamA = home.team?.displayName || home.team?.name || 'Team A';
    const teamB = away.team?.displayName || away.team?.name || 'Team B';
    const onChainId = espnIdToOnChain(espnId);

    console.log(`ESPN Event: ${teamA} vs ${teamB} (ID: ${espnId})`);
    console.log(`  - On-chain ID derived: ${onChainId.toString()}`);
    console.log(`  - ESPN Status: ${status}`);

    try {
      const matchData = await hook.matches(onChainId);
      const exists = matchData.id !== 0n;
      console.log(`  - Exists on-chain? ${exists}`);
      if (exists) {
        console.log(`    - Team A: ${matchData.teamA}`);
        console.log(`    - Team B: ${matchData.teamB}`);
        console.log(`    - Start Time: ${new Date(Number(matchData.startTime) * 1000).toISOString()}`);
        console.log(`    - End Time: ${new Date(Number(matchData.endTime) * 1000).toISOString()}`);
        console.log(`    - Resolved: ${matchData.resolved}`);
        console.log(`    - Winner: ${matchData.winner}`);
      }
    } catch (err) {
      console.log(`  - Error querying: ${err.message}`);
    }
    console.log();
  }
}

main().catch(console.error);
