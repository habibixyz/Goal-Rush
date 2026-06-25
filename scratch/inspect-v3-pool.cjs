const { ethers } = require("hardhat");

async function main() {
  const address = "0xa0b4EC3D6e3dac466572ef85582FC6233aA13a03";

  console.log(`Inspecting contract: ${address}`);

  const v3PoolAbi = [
    "function factory() external view returns (address)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function fee() external view returns (uint24)",
    "function tickSpacing() external view returns (int24)",
    "function liquidity() external view returns (uint128)",
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)"
  ];

  const pool = new ethers.Contract(address, v3PoolAbi, ethers.provider);

  for (const fn of ["factory", "token0", "token1", "fee", "tickSpacing", "liquidity", "slot0"]) {
    try {
      const res = await pool[fn]();
      console.log(`✅ ${fn}():`, JSON.stringify(res, (k, v) => typeof v === 'bigint' ? v.toString() : v));
    } catch (e) {
      console.log(`❌ ${fn}() failed:`, e.message);
    }
  }
}

main().catch(console.error);
