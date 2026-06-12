const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Gas Balance: ${ethers.formatEther(balance)} OKB`);

  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const deployerAddress = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

  const pmCode = await ethers.provider.getCode(poolManagerAddress);
  console.log(`PoolManager code exists: ${pmCode !== "0x"}`);

  const factoryCode = await ethers.provider.getCode(deployerAddress);
  console.log(`CREATE2 Deployer factory code exists: ${factoryCode !== "0x"}`);
}

main().catch(console.error);
