const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

const targetStr = `        if (Array.isArray(data)) {
          setLiveMatches(data);
        }`;

const replacementStr = `        if (Array.isArray(data)) {
          setLiveMatches(data);
          setActiveMatch(prev => {
            if (prev.id === 10 && data.length > 0) {
              const defaultMatch = data.find(m => m.isLive) || data[0];
              return {
                ...prev,
                id: defaultMatch.id,
                dbId: defaultMatch.dbId,
                startTime: defaultMatch.startTime,
                teamA: defaultMatch.teamA,
                teamB: defaultMatch.teamB,
                flagA: defaultMatch.flagA || getTeamFifaCode(defaultMatch.teamA),
                flagB: defaultMatch.flagB || getTeamFifaCode(defaultMatch.teamB),
                resolved: false,
                isLive: defaultMatch.isLive !== undefined ? defaultMatch.isLive : true,
                minute: defaultMatch.minute || "1'"
              };
            }
            return prev;
          });
        }`;

// Replace ignoring \r
const appNormalized = app.replace(/\r\n/g, '\n');
const appPatched = appNormalized.replace(targetStr.replace(/\r\n/g, '\n'), replacementStr);

fs.writeFileSync('src/App.jsx', appPatched);
console.log('App patched!');
