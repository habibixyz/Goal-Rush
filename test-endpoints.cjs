async function testEndpoint(url) {
  try {
    const response = await fetch(url);
    console.log(`\n=== Testing ${url} ===`);
    console.log(`Status: ${response.status}`);
    
    // Convert headers to a plain object
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }
    console.log('Headers:', JSON.stringify(headers, null, 2));
    
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err.message);
  }
}

async function run() {
  await testEndpoint('https://goal-rush-backend-production.up.railway.app/api/predict');
  await testEndpoint('https://goal-rush-backend-production.up.railway.app/api/news');
  await testEndpoint('https://goal-rush-backend-production.up.railway.app/api/agent/predictions');
}

run();
