const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8');

// 1. Wipe the hardcoded onChainStats
const statsStart = app.indexOf('  const [onChainStats, setOnChainStats] = useState({');
const statsEnd = app.indexOf('  });', statsStart) + 5;

if (statsStart > -1 && statsEnd > -1) {
  app = app.substring(0, statsStart) + '  const [onChainStats, setOnChainStats] = useState({});\n' + app.substring(statsEnd);
}

// 2. Fix the match data fetching logic
const fetchStartStr = '        // Fetch selected match info safely\n        try {\n          const isRealWorld = typeof currentId === \'string\' && currentId.startsWith(\'api-\');';
const fetchEndStr = '        } catch (matchErr) {\n          console.warn("Failed to fetch match data from hook contract for ID:", currentId, matchErr);\n        }';

const fetchStartIdx = app.indexOf(fetchStartStr);
const fetchEndIdx = app.indexOf(fetchEndStr, fetchStartIdx) + fetchEndStr.length;

if (fetchStartIdx > -1 && fetchEndIdx > -1) {
  const newFetch = `        // Fetch selected match info safely
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
        } catch (matchErr) {
          console.warn("Failed to fetch match data from hook contract for ID:", currentId, matchErr);
        }`;
        
  app = app.substring(0, fetchStartIdx) + newFetch + app.substring(fetchEndIdx);
  fs.writeFileSync('src/App.jsx', app);
  console.log('App.jsx patched successfully!');
} else {
  console.log('Could not find markers', {fetchStartIdx, fetchEndIdx});
}
