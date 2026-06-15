const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  const hookAddress = "0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0";
  const grushTokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  
  const abi = [
    "function activeMatchId() external view returns (uint256)",
    "function matches(uint256) external view returns (uint256 id, string teamA, string teamB, uint256 startTime, uint256 endTime, bool resolved, uint8 winner, uint256 totalJackpot, uint256 totalPredictionVolume)",
    "function teamPredictionVolume(uint256, uint8) external view returns (uint256)",
    "function teamGrushPredictionVolume(uint256, uint8) external view returns (uint256)",
    "function matchGrushJackpot(uint256) external view returns (uint256)"
  ];

  const grushAbi = [
    "function balanceOf(address) external view returns (uint256)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, owner);
  const grush = new ethers.Contract(grushTokenAddress, grushAbi, owner);

  console.log("Querying Match #10 details...");
  const matchData = await hook.matches(10);
  console.log("Match Data:", {
    id: matchData.id.toString(),
    teamA: matchData.teamA,
    teamB: matchData.teamB,
    resolved: matchData.resolved,
    winner: matchData.winner.toString(),
    totalJackpot: ethers.formatEther(matchData.totalJackpot),
    totalPredictionVolume: ethers.formatEther(matchData.totalPredictionVolume)
  });

  const balance = await ethers.provider.getBalance(hookAddress);
  console.log("Hook Contract OKB Balance:", ethers.formatEther(balance));

  const grushBalance = await grush.balanceOf(hookAddress);
  console.log("Hook Contract GRUSH Balance:", ethers.formatEther(grushBalance));
}

main().catch(console.error);
