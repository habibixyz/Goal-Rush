const axios = require('axios');

async function main() {
  try {
    const res = await axios.get('https://goal-rush-backend-production.up.railway.app/api/matches/live');
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error("Error fetching live matches:", e.message);
  }
}

main();
