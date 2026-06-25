const { ethers } = require("hardhat");

async function main() {
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const poolId = "0xd639d7f0dc532caec7e31703281519f9e59a027a93ab71df3257ef9454fbef4f";

  const poolManager = await ethers.getContractAt([
    "function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)"
  ], poolManagerAddress);

  try {
    const slot0 = await poolManager.getSlot0(poolId);
    console.log(`Slot0 for pool ${poolId}:`);
    console.log(`  SqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);
    console.log(`  Tick: ${slot0.tick}`);
    console.log(`  ProtocolFee: ${slot0.protocolFee}`);
    console.log(`  LpFee: ${slot0.lpFee}`);
    
    const liq = await poolManager.getLiquidity(poolId);
    console.log(`Liquidity: ${liq.toString()}`);
  } catch (e) {
    console.error("Failed to query pool view functions:", e.message);
  }
}

main().catch(console.error);
