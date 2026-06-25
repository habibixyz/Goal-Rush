const { ethers } = require("hardhat");

async function main() {
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  
  // Topic for Initialize(bytes32 indexed poolId, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks)
  const initializeTopic = ethers.id("Initialize(bytes32,address,address,uint24,int24,address)");
  
  const startBlock = 62525700;
  const scanRange = 10000;
  const chunkSize = 90;

  for (let from = startBlock; from < startBlock + scanRange; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, startBlock + scanRange);
    try {
      const logs = await ethers.provider.getLogs({
        address: poolManagerAddress,
        topics: [initializeTopic],
        fromBlock: from,
        toBlock: to
      });

      for (const log of logs) {
        // Decode the event data and topics
        // Topics: [eventSignature, poolId, currency0, currency1]
        // Data: fee (uint24), tickSpacing (int24), hooks (address)
        const currency0 = ethers.isAddress(log.topics[2]) ? log.topics[2] : "0x" + log.topics[2].slice(26);
        const currency1 = ethers.isAddress(log.topics[3]) ? log.topics[3] : "0x" + log.topics[3].slice(26);

        if (
          currency0.toLowerCase() === tokenAddress.toLowerCase() ||
          currency1.toLowerCase() === tokenAddress.toLowerCase()
        ) {
          console.log(`🎉 Found pool initialization in block ${log.blockNumber}!`);
          console.log(`Tx Hash: ${log.transactionHash}`);
          
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint24", "int24", "address"],
            log.data
          );
          
          console.log({
            currency0,
            currency1,
            fee: decoded[0],
            tickSpacing: decoded[1],
            hooks: decoded[2],
            poolId: log.topics[1]
          });
          return;
        }
      }
    } catch (e) {
      console.log(`Error scanning ${from} to ${to}:`, e.message);
    }
  }

  console.log("❌ Could not find initialization in the last 3000 blocks.");
}

main().catch(console.error);
