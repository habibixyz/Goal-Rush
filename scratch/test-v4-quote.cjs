const { ethers } = require("hardhat");

async function main() {
  const POOL_KEY = {
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: "0x422fe165b2da990d18c6dca944b11dcd61519671",
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x026198469007ad6a9ffa9e161b7a2d6dce542088"
  };

  const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const amountIn = ethers.parseEther("1.0"); // 1 OKB

  // Use Quoter contract or compute from sqrtPriceX96
  // Let's compute from slot0 data
  const pm = await ethers.getContractAt([
    "function extsload(bytes32 slot) external view returns (bytes32)"
  ], POOL_MANAGER);

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const poolId = ethers.keccak256(abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [POOL_KEY.currency0, POOL_KEY.currency1, POOL_KEY.fee, POOL_KEY.tickSpacing, POOL_KEY.hooks]
  ));

  const slot0Key = ethers.keccak256(abiCoder.encode(["bytes32", "uint256"], [poolId, 6n]));
  const slot0Data = await pm.extsload(slot0Key);

  // Parse sqrtPriceX96 from slot0 (last 20 bytes = 160 bits)
  const dataHex = slot0Data.slice(2);
  const sqrtPriceX96Hex = dataHex.slice(64 - 40);
  const sqrtPriceX96 = BigInt("0x" + sqrtPriceX96Hex);

  console.log(`sqrtPriceX96: ${sqrtPriceX96}`);

  // Price = (sqrtPriceX96 / 2^96)^2
  // For zeroForOne (OKB → GRUSH): amountOut ≈ amountIn * price
  const Q96 = 2n ** 96n;
  // price = sqrtPriceX96^2 / Q96^2
  // amountOut = amountIn * sqrtPriceX96^2 / Q96^2
  const amountOut = (amountIn * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);

  console.log(`\nFor ${ethers.formatEther(amountIn)} OKB:`);
  console.log(`Estimated GRUSH out: ${ethers.formatEther(amountOut)} GRUSH`);
  console.log(`Price: 1 OKB ≈ ${Number(amountOut) / Number(amountIn)} GRUSH`);

  // Also try the Quoter V2 contract if available
  // Common V4 Quoter address pattern
  const quoterAddresses = [
    "0xC195976fEF0985886E37036E2DF62bF371E12Df0", // Quoter V2 (common across chains)
    "0x00c0ffeec0ffeec0ffeec0ffeec0ffeec0ffee42"  // placeholder
  ];

  for (const quoterAddr of quoterAddresses) {
    const code = await ethers.provider.getCode(quoterAddr);
    if (code.length > 2) {
      console.log(`\nFound Quoter at ${quoterAddr} (${code.length} bytes)`);
    }
  }
}

main().catch(console.error);
