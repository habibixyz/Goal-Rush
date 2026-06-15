const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Remove TEAM_POOL and generateRandomMatch
const teamPoolRegex = /const TEAM_POOL = \[\s*\{[\s\S]*?const generateRandomMatch = [\s\S]*?};\s*\n/m;
app = app.replace(teamPoolRegex, '');

// 2. Replace the massive useState([ ... ]) with useState([])
const liveMatchesRegex = /const \[liveMatches,\s*setLiveMatches\] = useState\(\[[\s\S]*?\]\);\s*\n/m;
app = app.replace(liveMatchesRegex, '  const [liveMatches, setLiveMatches] = useState([]);\n');

// 3. Simplify loadRealMatches to strictly overwrite state and remove mock merging
const loadRealMatchesRegex = /const loadRealMatches = async \(\) => \{[\s\S]*?setInterval\(loadRealMatches, 300000\);\s*return \(\) => clearInterval\(interval\);\s*\}, \[\]\);/m;
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
  }, []);`;
app = app.replace(loadRealMatchesRegex, cleanLoadRealMatches);

// 4. Find the local tick simulation and remove it
const localTickRegex = /useEffect\(\(\) => \{\s*const interval = setInterval\(\(\) => \{\s*setLiveMatches\(\(prev\) => \{\s*const now = Date\.now\(\);[\s\S]*?\}, 60000\);\s*\/\/\s*update every minute\s*return \(\) => clearInterval\(interval\);\s*\}, \[\]\);/m;
app = app.replace(localTickRegex, '');

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx cleaned up!');
