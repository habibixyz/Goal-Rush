const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x5b13c480dcd4f19deb523004f03997708191dc7e29db9b8be616586e49ebe767";
  const tx = await ethers.provider.getTransaction(txHash);
  const receipt = await ethers.provider.getTransactionReceipt(txHash);

  console.log(`Transaction details for ${txHash}:`);
  console.log(`  From: ${tx.from}`);
  console.log(`  To: ${tx.to}`);
  console.log(`  Value: ${ethers.formatEther(tx.value)} OKB`);
  console.log(`  Input Data: ${tx.data}`);

  console.log(`Receipt Status: ${receipt.status}`);
  console.log(`Number of Logs: ${receipt.logs.length}`);
  
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`Log ${i}: Address ${log.address}`);
    console.log(`  Topics:`, log.topics);
  }
}

main().catch(console.error);
