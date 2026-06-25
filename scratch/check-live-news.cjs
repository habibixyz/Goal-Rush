const https = require('https');

console.log('Fetching news from production backend...');
https.get('https://goal-rush-backend-production.up.railway.app/api/news', (res) => {
  console.log(`Status code: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Raw response:', data);
  });
}).on('error', (err) => {
  console.error('Request error:', err.message);
});
