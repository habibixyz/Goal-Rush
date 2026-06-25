const { ethers } = require("hardhat");

async function main() {
  const factoryAddress = "0xBf2334d853D1239B093934c2BCB7a78869d1F287";
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";

  console.log("Checking events for Factory:", factoryAddress);
  console.log("Checking events for Hook:", hookAddress);
  console.log("Checking events for Token:", tokenAddress);

  // Let's get logs from Hook
  const currentBlock = await ethers.provider.getBlockNumber();
  const startBlock = currentBlock - 1000; // Search last 1000 blocks

  // Let's search for any transaction that interacted with the hook contract in the last 1000 blocks
  // Since we can't query all TXs easily, let's query the pool logs or pool initialization logs.
  // Uniswap V4 PoolManager emits PoolInitialized events.
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const poolInitializedTopic = ethers.id("Initialize(bytes32,address,address,uint24,int24,address)");

  console.log("Querying PoolManager Initialize events...");
  
  // Since the range is capped at 100 blocks, let's loop or query a specific block range if we know when the token was deployed.
  // Wait, let's search from block 60,000,000 to latest in chunks of 90 blocks?
  // That could be slow, but let's query the last 90 blocks first.
  const logs = await ethers.provider.getLogs({
    address: poolManagerAddress,
    topics: [poolInitializedTopic],
    fromBlock: currentBlock - 90,
    toBlock: "latest"
  });

  console.log(`Found ${logs.length} Initialize events in the last 90 blocks.`);

  // Let's also check if the hook has a direct getter or storage variable we can query.
  // Often the PoolKey or parts of it are public variables.
  // Let's inspect all public storage variables or view functions on the hook contract!
  // We can query the hook with some common variable names:
  const possibleGetters = [
    "function fee() external view returns (uint24)",
    "function tickSpacing() external view returns (int24)",
    "function getFee() external view returns (uint24)",
    "function getTickSpacing() external view returns (int24)",
    "function poolId() external view returns (bytes32)"
  ];

  for (const sig of possibleGetters) {
    try {
      const contract = await ethers.getContractAt([sig], hookAddress);
      const funcName = sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName]();
      console.log(`Hook ✅ ${funcName}(): ${res}`);
    } catch (e) {
      // ignore
    }
  }

  // Also check factory:
  const factoryGetters = [
    "function fee() external view returns (uint24)",
    "function tickSpacing() external view returns (int24)",
    "function getPoolKey(address token) external view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))"
  ];
  for (const sig of factoryGetters) {
    try {
      const contract = await ethers.getContractAt([sig], factoryAddress);
      const funcName = sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName]();
      console.log(`Factory ✅ ${funcName}(): ${JSON.stringify(res)}`);
    } catch (e) {
      // ignore
    }
  }
}

main().catch(console.error);
