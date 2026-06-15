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
  const sEndStr = '\\n  });';
  const statsEnd = app.indexOf(sEndStr, statsStart);
  if (statsEnd > statsStart) {
    app = app.substring(0, statsStart) + '  const [onChainStats, setOnChainStats] = useState({});' + app.substring(statsEnd + sEndStr.length);
  }
}

// 5. Update the match fetching logic
const fIdx = app.indexOf('// Fetch selected match info safely');
if (fIdx !== -1) {
    const endFIdx = app.indexOf('} catch (matchErr) {', fIdx);
    if (endFIdx !== -1) {
        const replacement = `// Fetch selected match info safely
        try {
          // ALWAYS fetch the on-chain active match for jackpot pool and prediction stats
          const activeIdFromContract = Number(await hookContract.activeMatchId());
          
          if (activeIdFromContract > 0) {
            const matchData = await hookContract.matches(activeIdFromContract);
            const teamAName = matchData[1] || matchData.teamA || 'Team A';
            const teamBName = matchData[2] || matchData.teamB || 'Team B';
            const isResolved = matchData[5] !== undefined ? matchData[5] : matchData.resolved;
            const winnerId = Number(matchData[6] !== undefined ? matchData[6] : (matchData.winner || 0));

            // Keep the active onchain match ref updated
            activeOnChainMatchRef.current = {
              id: activeIdFromContract,
              teamA: teamAName,
              teamB: teamBName
            };

            const totalJackpotWei = matchData[7] || matchData.totalJackpot || 0n;
            const contractBalance = await rpcProvider.getBalance(hookAddress);
            const displayJackpot = contractBalance > totalJackpotWei ? contractBalance : totalJackpotWei;
            setJackpot(Number(ethers.formatEther(displayJackpot)));

            const volA = await hookContract.teamPredictionVolume(activeIdFromContract, 1);
            const volB = await hookContract.teamPredictionVolume(activeIdFromContract, 2);
            setTeamAVotes(Number(ethers.formatEther(volA)));
            setTeamBVotes(Number(ethers.formatEther(volB)));

            try {
              const grushPool = await hookContract.matchGrushJackpot(activeIdFromContract);
              const grushVolA = await hookContract.teamGrushPredictionVolume(activeIdFromContract, 1);
              const grushVolB = await hookContract.teamGrushPredictionVolume(activeIdFromContract, 2);
              setGrushJackpot(Number(ethers.formatEther(grushPool)));
              setTeamAGrushVotes(Number(ethers.formatEther(grushVolA)));
              setTeamBGrushVotes(Number(ethers.formatEther(grushVolB)));
            } catch (grushErr) {
              setGrushJackpot(0);
              setTeamAGrushVotes(0);
              setTeamBGrushVotes(0);
            }

            // If the UI is currently viewing the on-chain match, sync its resolution state
            if (currentId === activeIdFromContract) {
              setActiveMatch(prev => {
                if (prev.id !== currentId) return prev;
                if (prev.teamA === teamAName && prev.teamB === teamBName && prev.resolved === isResolved && prev.winner === winnerId) {
                  return prev;
                }
                return {
                  ...prev,
                  id: currentId,
                  teamA: teamAName,
                  teamB: teamBName,
                  flagA: getTeamFifaCode(teamAName),
                  flagB: getTeamFifaCode(teamBName),
                  resolved: isResolved,
                  winner: winnerId
                };
              });
            }
          } else {
            setJackpot(0);
            setGrushJackpot(0);
            setTeamAVotes(0);
            setTeamBVotes(0);
            setTeamAGrushVotes(0);
            setTeamBGrushVotes(0);
          }
        `;
        app = app.substring(0, fIdx) + replacement + app.substring(endFIdx);
    }
}

fs.writeFileSync('src/App.jsx', app);
console.log('App patched flawlessly!');
