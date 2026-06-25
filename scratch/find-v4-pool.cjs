const { ethers } = require("hardhat");

// PoolKey struct helper
function getPoolId(key) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  );
  return ethers.keccak256(encoded);
}

async function main() {
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const wokbAddress = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";
  const nativeToken = "0x0000000000000000000000000000000000000000";

  const poolManager = await ethers.getContractAt([
    "function pools(bytes32 poolId) external view returns (uint128 liquidity, uint160 sqrtPriceX96, int24 tick)"
  ], poolManagerAddress);

  // Likely currency combinations
  const currencyPairs = [
    // [currency0, currency1]
    [nativeToken, tokenAddress],
    [tokenAddress, wokbAddress]
  ];

  // Common fees in Uniswap V4
  const fees = [0, 500, 3000, 10000];

  // Common tick spacings
  const tickSpacings = [10, 60, 120, 200];

  console.log("Brute-forcing PoolManager pools...");

  for (const pair of currencyPairs) {
    for (const fee of fees) {
      for (const tickSpacing of tickSpacings) {
        const key = {
          currency0: pair[0],
          currency1: pair[1],
          fee: fee,
          tickSpacing: tickSpacing,
          hooks: hookAddress
        };

        const poolId = getPoolId(key);
        try {
          const res = await poolManager.pools(poolId);
          if (res.sqrtPriceX96 > 0n) {
            console.log("🎉 FOUND ACTIVE POOL!");
            console.log("PoolKey:", JSON.stringify(key, null, 2));
            console.log("PoolId:", poolId);
            console.log(`Liquidity: ${res.liquidity}`);
            console.log(`SqrtPriceX96: ${res.sqrtPriceX96}`);
            console.log(`Tick: ${res.tick}`);
            return;
          }
        } catch (e) {
          // ignore revert
        }
      }
    }
  }

  console.log("❌ No active Uniswap V4 pool found in PoolManager with the specified combinations.");
}

main().catch(console.error);
