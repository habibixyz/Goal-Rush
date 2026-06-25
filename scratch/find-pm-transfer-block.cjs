const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const pmAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";

  const tokenAbi = [
    "function balanceOf(address account) external view returns (uint256)"
  ];
  const token = new ethers.Contract(tokenAddress, tokenAbi, ethers.provider);

  let low = 62525700;
  let high = await ethers.provider.getBlockNumber();

  console.log(`Binary searching PoolManager token balance transition in block range [${low}, ${high}]...`);

  let transitionBlock = high;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    try {
      const bal = await token.balanceOf(pmAddress, { blockTag: mid });
      if (bal > 0n) {
        transitionBlock = mid;
        high = mid - 1; // Try to find earlier block where balance was already > 0
      } else {
        low = mid + 1; // Balance was still 0
      }
    } catch (e) {
      // If block is before deployment, it might fail or return 0.
      // Move low up if we get an error.
      low = mid + 1;
    }
  }

  console.log(`🎉 PoolManager balance became > 0 at block: ${transitionBlock}`);

  // Now, let's query the logs in that specific block to see the transaction!
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const logs = await ethers.provider.getLogs({
    address: tokenAddress,
    topics: [transferTopic],
    fromBlock: transitionBlock,
    toBlock: transitionBlock
  });

  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ]);

  console.log(`Found ${logs.length} transfers in block ${transitionBlock}:`);
  for (const log of logs) {
    const decoded = iface.parseLog(log);
    console.log(`Tx ${log.transactionHash}:`);
    console.log(`  From: ${decoded.args.from}`);
    console.log(`  To: ${decoded.args.to}`);
    console.log(`  Value: ${ethers.formatEther(decoded.args.value)} GRUSH`);
  }
}

main().catch(console.error);
