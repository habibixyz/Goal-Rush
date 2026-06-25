const { ethers } = require("hardhat");

function getPoolId(key) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  );
  return ethers.keccak256(encoded);
}

async function main() {
  const targetPoolId = "0xd639d7f0dc532caec7e31703281519f9e59a027a93ab71df3257ef9454fbef4f";

  // Extracted from graduation tx calldata
  const key = {
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: "0x422fe165b2da990d18c6dca944b11dcd61519671",
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x026198469007ad6a9ffa9e161b7a2d6dce542088"
  };

  const poolId = getPoolId(key);
  console.log("Computed PoolId:", poolId);
  console.log("Target   PoolId:", targetPoolId);
  console.log("Match:", poolId === targetPoolId ? "🎉 YES!" : "❌ NO");

  if (poolId === targetPoolId) {
    console.log("\n=== CONFIRMED POOL KEY ===");
    console.log(JSON.stringify(key, null, 2));

    // Verify the pool has liquidity by reading slot0 via extsload
    const pmAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
    const pm = await ethers.getContractAt([
      "function extsload(bytes32 slot) external view returns (bytes32)"
    ], pmAddress);

    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const slot0Key = ethers.keccak256(abiCoder.encode(["bytes32", "uint256"], [poolId, 6n]));
    const slot0Data = await pm.extsload(slot0Key);
    console.log("\nSlot0 raw:", slot0Data);

    // Read liquidity from slot0 + 3 (or wherever it is)
    const liqSlot = BigInt(slot0Key) + 3n;
    const liqData = await pm.extsload("0x" + liqSlot.toString(16).padStart(64, "0"));
    console.log("Liquidity raw:", liqData);
    console.log("Liquidity:", BigInt(liqData).toString());

    // Check hook bytecode
    const hookCode = await ethers.provider.getCode(key.hooks);
    console.log(`\nHook (${key.hooks}) bytecode size: ${hookCode.length} chars`);

    // Check GRUSH balance in PoolManager
    const token = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], key.currency1);
    const pmBal = await token.balanceOf(pmAddress);
    console.log(`PoolManager GRUSH balance: ${ethers.formatEther(pmBal)} GRUSH`);
    
    // Check native OKB balance in PoolManager
    const okbBal = await ethers.provider.getBalance(pmAddress);
    console.log(`PoolManager OKB balance: ${ethers.formatEther(okbBal)} OKB`);
  }
}

main().catch(console.error);
