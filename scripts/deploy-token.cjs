const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying GoalRushToken with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native gas token`);

  // We want to deploy with an initial supply of 100,000,000 GRUSH tokens
  const initialSupply = 100000000n; // 100 Million
  console.log(`Target Initial Supply: ${initialSupply.toLocaleString()} GRUSH`);

  const TokenFactory = await ethers.getContractFactory("GoalRushToken");
  const token = await TokenFactory.deploy(initialSupply);

  console.log(`Transaction submitted: ${token.deploymentTransaction().hash}`);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log(`🎉 GoalRushToken (GRUSH) successfully deployed to: ${tokenAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
