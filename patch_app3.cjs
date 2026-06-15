const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8');

// 1. handleSelectMatchUI
const hIdx = app.indexOf('  const handleSelectMatchUI = (match) => {');
if (hIdx !== -1) {
    const endIdx = app.indexOf('    });', hIdx);
    if (endIdx !== -1) {
        let block = app.substring(hIdx, endIdx);
        // If it doesn't already have dbId, add it
        if (!block.includes('dbId:')) {
            block = block.replace('id: match.id,', 'id: match.id,\n      dbId: match.dbId,\n      startTime: match.startTime,');
            app = app.substring(0, hIdx) + block + app.substring(endIdx);
            console.log('Patched handleSelectMatchUI');
        }
    }
}

// 2. Fetch match info safely
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
        console.log('Patched fetch logic');
    }
}

fs.writeFileSync('src/App.jsx', app);
