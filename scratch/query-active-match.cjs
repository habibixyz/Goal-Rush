const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
  const abi = [
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];
  
  const provider = new ethers.JsonRpcProvider("https://xlayer-mainnet.rpc.sentio.xyz");
  const hook = new ethers.Contract(hookAddress, abi, provider);
  
  const activeId = await hook.activeMatchId();
  console.log("Active Match ID:", activeId.toString());
  
  if (activeId > 0n) {
    const matchData = await hook.matches(activeId);
    console.log("Match Details:", matchData);
  }
}

main().catch(console.error);
