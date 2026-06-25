const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  console.log("Querying Transfer events for:", tokenAddress);

  const filter = {
    address: tokenAddress,
    topics: [
      ethers.id("Transfer(address,address,uint256)")
    ]
  };

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log("Current block:", currentBlock);

  // Search last 90 blocks
  const startBlock = currentBlock - 90;
  const logs = await ethers.provider.getLogs({
    ...filter,
    fromBlock: startBlock,
    toBlock: "latest"
  });

  console.log(`Found ${logs.length} Transfer events in the last 10,000 blocks.`);

  // Inspect the last 10 transactions to see the 'to' address and 'from' address
  const maxToInspect = Math.min(logs.length, 10);
  for (let i = 0; i < maxToInspect; i++) {
    const log = logs[logs.length - 1 - i];
    const tx = await ethers.provider.getTransaction(log.transactionHash);
    console.log(`Tx ${i + 1}: ${log.transactionHash}`);
    console.log(`  - From: ${tx.from}`);
    console.log(`  - To: ${tx.to}`);
    console.log(`  - Value sent: ${ethers.formatEther(tx.value)} OKB`);
    if (tx.data.length > 10) {
      console.log(`  - Method Selector: ${tx.data.substring(0, 10)}`);
    }
  }
}

main().catch(console.error);
