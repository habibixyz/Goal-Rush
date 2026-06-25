const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const currentBlock = await ethers.provider.getBlockNumber();
  const startBlock = currentBlock - 2000; // scan last 2000 blocks

  console.log(`Scanning logs from block ${startBlock} to ${currentBlock}...`);

  // Let's scan Transfer events on GRUSH token
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  
  const chunkSize = 90;
  let transfers = [];
  for (let from = startBlock; from <= currentBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, currentBlock);
    try {
      const logs = await ethers.provider.getLogs({
        address: tokenAddress,
        topics: [transferTopic],
        fromBlock: from,
        toBlock: to
      });
      if (logs.length > 0) {
        console.log(`Found ${logs.length} transfers in blocks ${from} to ${to}`);
        transfers.push(...logs);
      }
    } catch (e) {
      console.error(`Error scanning ${from} to ${to}:`, e.message);
    }
  }

  console.log(`Total transfers found: ${transfers.length}`);
  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ]);

  for (const log of transfers) {
    const decoded = iface.parseLog(log);
    console.log(`Tx ${log.transactionHash} (Block ${log.blockNumber}):`);
    console.log(`  From: ${decoded.args.from}`);
    console.log(`  To: ${decoded.args.to}`);
    console.log(`  Value: ${ethers.formatEther(decoded.args.value)} GRUSH`);
  }
}

main().catch(console.error);
