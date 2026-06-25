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
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const wokbAddress = "0xe538905cf8410324e03A5A23C1c177a474D59b2b";
  const nativeToken = "0x0000000000000000000000000000000000000000";
  const appHookAddress = "0x700656337a252A004Ca0B170828f4adEaa680288";
  const customAddr = "0xa0b4EC3D6e3dac466572ef85582FC6233aA13a03";

  const poolManager = await ethers.getContractAt([
    "function pools(bytes32 poolId) external view returns (uint128 liquidity, uint160 sqrtPriceX96, int24 tick)"
  ], poolManagerAddress);

  // Currency combinations
  const tokensSorted1 = [nativeToken, tokenAddress].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const tokensSorted2 = [wokbAddress, tokenAddress].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const pairs = [tokensSorted1, tokensSorted2];
  const fees = [0, 500, 3000, 5000, 10000];
  const tickSpacings = [10, 60, 120, 200];
  const hookAddresses = [
    "0x0000000000000000000000000000000000000000",
    "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0", // EulrHook
    appHookAddress,
    customAddr
  ];

  console.log("Brute-forcing PoolManager pools...");

  for (const pair of pairs) {
    for (const fee of fees) {
      for (const tickSpacing of tickSpacings) {
        for (const hook of hookAddresses) {
          const key = {
            currency0: pair[0],
            currency1: pair[1],
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hook
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
            // ignore
          }
        }
      }
    }
  }

  console.log("❌ No active Uniswap V4 pool found.");
}

main().catch(console.error);
