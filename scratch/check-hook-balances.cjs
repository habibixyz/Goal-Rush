const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";

  // 1. Hook OKB Balance
  const okbBal = await ethers.provider.getBalance(hookAddress);
  console.log(`Hook OKB Balance: ${ethers.formatEther(okbBal)} OKB`);

  // 2. Hook GRUSH Token Balance
  const tokenAbi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)"
  ];
  const token = new ethers.Contract(tokenAddress, tokenAbi, ethers.provider);
  
  try {
    const grushBal = await token.balanceOf(hookAddress);
    console.log(`Hook GRUSH Balance: ${ethers.formatEther(grushBal)} GRUSH`);
    const total = await token.totalSupply();
    console.log(`GRUSH Total Supply: ${ethers.formatEther(total)} GRUSH`);
  } catch (e) {
    console.error("Failed to query token balance:", e.message);
  }
}

main().catch(console.error);
