import handler from '../api/live.js';

async function test() {
  const req = {
    method: 'GET',
    url: '/api/live'
  };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      console.log("Status Code:", this.statusCode);
      
      const liveMatches = data.filter(m => m.isLive || m.status === 'LIVE');
      console.log(`Found ${liveMatches.length} live matches:`);
      for (const m of liveMatches) {
        console.log(`- ID: ${m.id} | ${m.teamA} vs ${m.teamB} | Status: ${m.status} | isLive: ${m.isLive}`);
      }

      const finishedMatches = data.filter(m => m.status === 'FINISHED' || m.isCompleted);
      console.log(`Found ${finishedMatches.length} finished matches:`);
      for (const m of finishedMatches) {
        console.log(`- ID: ${m.id} | ${m.teamA} vs ${m.teamB} | Status: ${m.status} | isCompleted: ${m.isCompleted}`);
      }
    }
  };

  try {
    await handler(req, res);
  } catch (err) {
    console.error("Handler error:", err);
  }
}

test();
