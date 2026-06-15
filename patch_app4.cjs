const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Add startTime
app = app.replace('dbId: match.dbId,', 'dbId: match.dbId,\n      startTime: match.startTime,');

// 2. Change logic condition
app = app.replace(
  ") : (!activeMatch.isLive && activeMatch.minute !== 'FT') ? (",
  ") : (!activeMatch.isLive && activeMatch.minute !== 'FT' && activeMatch.startTime && (activeMatch.startTime - Date.now() > 24 * 60 * 60 * 1000)) ? ("
);

// 3. Update gating text
app = app.replace(
  '<h4 style={{ color: \'#ffb300\', margin: \'0 0 8px 0\', fontSize: \'1rem\', fontWeight: 700 }}>⏳ MATCH NOT STARTED</h4>',
  '<h4 style={{ color: \'#ffb300\', margin: \'0 0 8px 0\', fontSize: \'1rem\', fontWeight: 700 }}>📅 UPCOMING MATCH</h4>'
);

app = app.replace(
  'is scheduled but not live yet.',
  'starts in more than 24 hours.'
);

app = app.replace(
  'Predictions open when the match goes LIVE.',
  'Predictions open 24 hours before kickoff.'
);

// 4. Wipe onChainStats
const statsStart = app.indexOf('  const [onChainStats, setOnChainStats] = useState({');
if (statsStart > -1) {
  const statsEnd = app.indexOf('  });', statsStart) + 5;
  if (statsEnd > statsStart) {
    app = app.substring(0, statsStart) + '  const [onChainStats, setOnChainStats] = useState({});\n' + app.substring(statsEnd);
  }
}

fs.writeFileSync('src/App.jsx', app);
console.log('App patched flawlessly!');
