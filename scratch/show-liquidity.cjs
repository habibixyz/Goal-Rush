const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x5b13c480dcd4f19deb523004f03997708191dc7e29db9b8be616586e49ebe767";
  const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const GRUSH_TOKEN = "0x422fe165b2da990d18c6dca944b11dcd61519671";

  console.log("=== GRUSH Pool Specific Liquidity ===\n");

  // 1. Check how much OKB was in the EulrHook BEFORE graduation (block before)
  const tx = await ethers.provider.getTransaction(txHash);
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  const blockBefore = receipt.blockNumber - 1;

  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  
  // OKB balance of EulrHook right before graduation
  const hookOkbBefore = await ethers.provider.getBalance(hookAddress, blockBefore);
  console.log(`EulrHook OKB BEFORE graduation (block ${blockBefore}): ${ethers.formatEther(hookOkbBefore)} OKB`);

  // OKB balance of EulrHook after graduation
  const hookOkbAfter = await ethers.provider.getBalance(hookAddress, receipt.blockNumber);
  console.log(`EulrHook OKB AFTER graduation (block ${receipt.blockNumber}): ${ethers.formatEther(hookOkbAfter)} OKB`);

  // OKB that moved out of hook = liquidity deposited into V4 pool
  const okbToPool = hookOkbBefore - hookOkbAfter;
  console.log(`\n💰 OKB moved from bonding curve → V4 pool: ${ethers.formatEther(okbToPool)} OKB`);

  // 2. GRUSH sent to PoolManager (we know this from Transfer logs)
  const token = new ethers.Contract(GRUSH_TOKEN, [
    "function balanceOf(address) view returns (uint256)"
  ], ethers.provider);
  
  const pmGrushBefore = await token.balanceOf(POOL_MANAGER, { blockTag: blockBefore });
  const pmGrushAfter = await token.balanceOf(POOL_MANAGER, { blockTag: receipt.blockNumber });
  const grushToPool = pmGrushAfter - pmGrushBefore;

  console.log(`💰 GRUSH deposited into V4 pool: ${ethers.formatEther(grushToPool)} GRUSH`);

  // 3. Current price
  const pm = new ethers.Contract(POOL_MANAGER, [
    "function extsload(bytes32 slot) external view returns (bytes32)"
  ], ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const poolId = "0xd639d7f0dc532caec7e31703281519f9e59a027a93ab71df3257ef9454fbef4f";
  const slot0Key = ethers.keccak256(abiCoder.encode(["bytes32", "uint256"], [poolId, 6n]));
  const slot0Data = await pm.extsload(slot0Key);
  const dataHex = slot0Data.slice(2);
  const sqrtPriceX96 = BigInt("0x" + dataHex.slice(64 - 40));
  const Q96 = 2n ** 96n;
  const priceNum = Number(sqrtPriceX96) / Number(Q96);
  const price = priceNum * priceNum;

  console.log(`\n📊 Current pool price: 1 OKB = ${price.toFixed(2)} GRUSH`);
  console.log(`📊 Current pool price: 1 GRUSH = ${(1/price).toFixed(8)} OKB`);

  console.log(`\n=== Summary ===`);
  console.log(`GRUSH V4 Pool reserves at graduation:`);
  console.log(`  OKB side:   ${ethers.formatEther(okbToPool)} OKB`);
  console.log(`  GRUSH side: ${ethers.formatEther(grushToPool)} GRUSH`);
}

main().catch(console.error);
