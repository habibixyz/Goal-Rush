const { ethers } = require("hardhat");

async function main() {
  const userAddress = "0xAe1B810fFB88855fFD967Dc274D9ba4fadd21990";
  const balance = await ethers.provider.getBalance(userAddress);
  console.log(`Balance of ${userAddress}: ${ethers.formatEther(balance)} OKB`);
}

main().catch(console.error);
