const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const pmAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const startBlock = 62525700;
  const currentBlock = await ethers.provider.getBlockNumber();

  console.log(`Querying Transfer events to PoolManager (${pmAddress})...`);

  // Transfer(address indexed from, address indexed to, uint256 value)
  // Topic 0: event sig
  // Topic 1: from (any)
  // Topic 2: to (pmAddress, padded to 32 bytes)
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const toTopic = ethers.zeroPadValue(pmAddress, 32);

  // Let's try querying the entire block range!
  try {
    const logs = await ethers.provider.getLogs({
      address: tokenAddress,
      topics: [transferTopic, null, toTopic],
      fromBlock: startBlock,
      toBlock: "latest"
    });
    console.log(`🎉 SUCCESS! Found ${logs.length} transfers to PoolManager!`);
    for (const log of logs) {
      console.log(`Tx: ${log.transactionHash} in block ${log.blockNumber}`);
    }
  } catch (e) {
    console.log("Failed to query full range:", e.message);
  }
}

main().catch(console.error);
