const { ethers } = require("hardhat");

async function main() {
  const factoryAddress = "0xBf2334d853D1239B093934c2BCB7a78869d1F287";
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";

  console.log(`Querying getPoolKey for token: ${tokenAddress}`);

  // Query on Factory
  try {
    const factory = await ethers.getContractAt([
      "function getPoolKey(address token) external view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))"
    ], factoryAddress);
    const key = await factory.getPoolKey(tokenAddress);
    console.log("Factory getPoolKey returned:", JSON.stringify(key, null, 2));
  } catch (e) {
    console.error("Factory getPoolKey failed:", e.message);
  }

  // Query on Hook
  try {
    const hook = await ethers.getContractAt([
      "function getPoolKey(address token) external view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))"
    ], hookAddress);
    const key = await hook.getPoolKey(tokenAddress);
    console.log("Hook getPoolKey returned:", JSON.stringify(key, null, 2));
  } catch (e) {
    console.error("Hook getPoolKey failed:", e.message);
  }

  // Also query other potential functions on Factory
  try {
    const factory = await ethers.getContractAt([
      "function poolKey(address token) external view returns (tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks))"
    ], factoryAddress);
    const key = await factory.poolKey(tokenAddress);
    console.log("Factory poolKey returned:", JSON.stringify(key, null, 2));
  } catch (e) {
    // ignore
  }
}

main().catch(console.error);
