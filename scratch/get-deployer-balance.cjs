const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Wallet:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "OKB");
}

main().catch(console.error);
