const fs = require('fs');
let api = fs.readFileSync('api/live.js', 'utf8');

const target = `    const backendData = await fetchFromBackend();
    if (Array.isArray(backendData) && backendData.length > 0) {
      const mapped = mapDatabaseMatches(backendData);`;

const replacement = `    const backendData = await fetchFromBackend();
    if (Array.isArray(backendData) && backendData.length > 0) {
      // Prioritize international matches
      const internationalTeams = ['Belgium', 'Egypt', 'Saudi Arabia', 'Uruguay', 'Iran', 'New Zealand', 'Spain', 'Cape Verde', 'France', 'Argentina', 'Netherlands', 'Japan'];
      backendData.sort((a, b) => {
        const aIsIntl = internationalTeams.includes(a.homeTeam.name) || internationalTeams.includes(a.awayTeam.name);
        const bIsIntl = internationalTeams.includes(b.homeTeam.name) || internationalTeams.includes(b.awayTeam.name);
        if (aIsIntl && !bIsIntl) return -1;
        if (!aIsIntl && bIsIntl) return 1;
        return 0;
      });
      const mapped = mapDatabaseMatches(backendData);`;

api = api.replace(target, replacement);
fs.writeFileSync('api/live.js', api);
console.log('Proxy API patched to prioritize international matches');
