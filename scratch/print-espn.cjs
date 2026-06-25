const https = require("https");
const fs = require("fs");

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
  
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${start}-${start}`;
  console.log("ESPN URL:", url);
  
  try {
    const data = await httpGet(url);
    if (data.events && data.events.length > 0) {
      console.log(`Found ${data.events.length} events.`);
      const firstEvent = data.events[0];
      console.log("First Event Summary:");
      console.log(JSON.stringify({
        id: firstEvent.id,
        name: firstEvent.name,
        date: firstEvent.date,
        status: firstEvent.status
      }, null, 2));
    } else {
      console.log("No events found.");
    }
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
