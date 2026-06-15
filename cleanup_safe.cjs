const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Remove TEAM_POOL and generateRandomMatch
const teamPoolStart = app.indexOf('const TEAM_POOL = [');
const teamPoolEnd = app.indexOf('// Helper to get the correct OKX Wallet provider strictly', teamPoolStart);
if (teamPoolStart > -1 && teamPoolEnd > -1) {
  app = app.substring(0, teamPoolStart) + app.substring(teamPoolEnd);
}

// 2. Replace the massive useState([...]) for liveMatches with useState([])
const liveMatchesStart = app.indexOf('const [liveMatches, setLiveMatches] = useState([');
const liveMatchesEnd = app.indexOf('  useEffect(() => {\n    liveMatchesRef.current = liveMatches;\n  }, [liveMatches]);');
if (liveMatchesStart > -1 && liveMatchesEnd > -1) {
  app = app.substring(0, liveMatchesStart) + 'const [liveMatches, setLiveMatches] = useState([]);\n\n' + app.substring(liveMatchesEnd);
}

// 3. Simplify loadRealMatches
const loadRealMatchesStart = app.indexOf('const loadRealMatches = async () => {');
const loadRealMatchesEnd = app.indexOf('  const [logs, setLogs] = useState([');
if (loadRealMatchesStart > -1 && loadRealMatchesEnd > -1) {
  const cleanLoadRealMatches = `const loadRealMatches = async () => {
      try {
        const response = await fetch('/api/live');
        if (!response.ok) throw new Error(\`HTTP status \${response.status}\`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setLiveMatches(data);
        }
      } catch (err) {
        console.warn('Failed to load real-world matches:', err);
      }
    };

    loadRealMatches();
    const interval = setInterval(loadRealMatches, 60000); // refresh every minute to catch anything socket missed
    return () => clearInterval(interval);
  }, []);\n\n`;
  app = app.substring(0, loadRealMatchesStart) + cleanLoadRealMatches + app.substring(loadRealMatchesEnd);
}

// 4. Find the local tick simulation and remove it
const tickSimulationStart = app.indexOf('// Real-time live match ticker \u2014 ticks every 5 seconds, advances 1 minute');
const tickSimulationEnd = app.indexOf('  useEffect(() => {\n    const fetchOnChainData = async () => {', tickSimulationStart);
if (tickSimulationStart > -1 && tickSimulationEnd > -1) {
  // We need to also remove the useEffect declaration that wraps it
  const useEffectStart = app.lastIndexOf('  useEffect(() => {\n', tickSimulationStart);
  if (useEffectStart > -1) {
    app = app.substring(0, useEffectStart) + app.substring(tickSimulationEnd);
  }
}

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx cleaned up safely!');
