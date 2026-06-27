require('dotenv').config({ path: '../../.env' });
const { ethers } = require('ethers');

const HOOK_ADDRESS = '0x700656337a252A004Ca0B170828f4adEaa680288';
const RPC_URL = process.env.XLAYER_MAINNET_RPC || 'https://rpc.xlayer.tech';

const HOOK_ABI = [
  'function activeMatchId() external view returns (uint256)',
  'function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)'
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const hook = new ethers.Contract(HOOK_ADDRESS, HOOK_ABI, provider);

  const activeMatchId = await hook.activeMatchId();
  console.log('Active Match ID:', activeMatchId.toString());

  const match = await hook.matches(activeMatchId);
  console.log('Match Details:', {
    id: match.id.toString(),
    teamA: match.teamA,
    teamB: match.teamB,
    startTime: new Date(Number(match.startTime) * 1000).toLocaleString(),
    endTime: new Date(Number(match.endTime) * 1000).toLocaleString(),
    resolved: match.resolved,
    winner: match.winner
  });
}
main();
