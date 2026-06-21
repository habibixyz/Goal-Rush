const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying GoalRushCollectible with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native gas token`);

  const grushTokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const CollectibleFactory = await ethers.getContractFactory("GoalRushCollectible");
  
  // Pass the GRUSH token address to the constructor
  const collectible = await CollectibleFactory.deploy(grushTokenAddress);

  console.log(`Transaction submitted: ${collectible.deploymentTransaction().hash}`);
  await collectible.waitForDeployment();

  const collectibleAddress = await collectible.getAddress();
  console.log(`🎉 GoalRushCollectible successfully deployed to: ${collectibleAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
