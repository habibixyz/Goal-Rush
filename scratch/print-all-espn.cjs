const https = require("https");

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

async function main() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const start = `${y}${m}${d}`;
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2);
  const ty = tomorrow.getUTCFullYear();
  const tm = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const td = String(tomorrow.getUTCDate()).padStart(2, '0');
  const end = `${ty}${tm}${td}`;
  
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${start}-${end}`;
  console.log("ESPN URL:", url);
  
  try {
    const data = await httpGet(url);
    if (data.events && data.events.length > 0) {
      console.log(`Found ${data.events.length} events:`);
      data.events.forEach((event, idx) => {
        console.log(`${idx + 1}. ${event.name} (ID: ${event.id})`);
        console.log(`   Kickoff (UTC): ${event.date}`);
        console.log(`   Status: ${event.status?.type?.name} (${event.status?.type?.description})`);
        console.log(`   Completed: ${event.status?.type?.completed}`);
      });
    } else {
      console.log("No events found.");
    }
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
