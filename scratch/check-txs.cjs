const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const txCount = await ethers.provider.getTransactionCount(deployer.address);
  const pendingTxCount = await ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log(`Transaction count: ${txCount}, Pending count: ${pendingTxCount}`);
  
  const feeData = await ethers.provider.getFeeData();
  console.log(`Fee data:`);
  console.log(`  gasPrice: ${feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "null"} gwei`);
  console.log(`  maxFeePerGas: ${feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") : "null"} gwei`);
  console.log(`  maxPriorityFeePerGas: ${feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") : "null"} gwei`);
}

main().catch(console.error);
