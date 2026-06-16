const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";

  console.log(`Using owner account: ${owner.address}`);
  
  const abi = [
    "function createMatch(uint256 _matchId, string _teamA, string _teamB, uint256 _duration) external",
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, owner);

  // Activate the real ID returned by the API
  const rawMatchId = "espn_760432";
  const numericId = BigInt(ethers.id(rawMatchId));

  console.log(`Match ID string: ${rawMatchId}`);
  console.log(`Numeric Match ID (hashed): ${numericId.toString()}`);

  const activeId = await hook.activeMatchId();
  console.log(`Current Active Match ID on contract: ${activeId.toString()}`);

  const matchData = await hook.matches(numericId);
  if (matchData.id.toString() === "0") {
    console.log(`Activating ${rawMatchId} on-chain...`);
    const tx = await hook.createMatch(numericId, "France", "Senegal", 30 * 24 * 60 * 60);
    console.log(`Transaction submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`${rawMatchId} successfully activated on-chain!`);
  } else {
    console.log(`${rawMatchId} already registered on-chain!`);
  }

  // Double check new active match ID
  const newActiveId = await hook.activeMatchId();
  console.log(`New Active Match ID on contract: ${newActiveId.toString()}`);
}

main().catch(console.error);
