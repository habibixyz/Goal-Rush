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
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`;
  console.log("Fetching default ESPN URL:", url);
  try {
    const data = await httpGet(url);
    const events = data.events || [];
    console.log(`Found ${events.length} events:`);
    events.forEach((event, idx) => {
      console.log(`${idx + 1}. ${event.name} (ID: ${event.id}) - Status: ${event.status?.type?.name}`);
    });
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error);
