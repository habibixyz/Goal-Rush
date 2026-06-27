const { ethers } = require('ethers');
async function main() {
  const p = new ethers.JsonRpcProvider("https://xlayer-mainnet.rpc.sentio.xyz");
  const hookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  
  const abi = [
    'function getUserPredictions(uint256 _matchId, address _user) external view returns (uint256[4] memory okbAmounts, uint256[4] memory grushAmounts, bool[4] memory okbClaimeds, bool[4] memory grushClaimeds)'
  ];
  
  const hook = new ethers.Contract(hookAddress, abi, p);
  const matchId = "112148998255574472646125133081482982285192713571382184000820023491906779961817";
  const agentAddress = "0xAe1B810fFB88855fFD967Dc274D9ba4fadd21990";
  
  try {
    const predictions = await hook.getUserPredictions(matchId, agentAddress);
    console.log("OKB Amounts:", predictions[0]);
    console.log("GRUSH Amounts:", predictions[1]);
  } catch(e) {
    console.error(e);
  }
}
main();
