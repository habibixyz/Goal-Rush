const { ethers } = require("hardhat");

async function main() {
  const data = "0x000000000bb800000002171c00000000000003af047b9cc71f3e54b70e6c4f66";
  
  // We want to decode Slot0 from the right side of the 32-byte word.
  // In Uniswap V4:
  // uint160 sqrtPriceX96; // 20 bytes
  // int24 tick;           // 3 bytes
  // uint24 protocolFee;   // 3 bytes
  // uint24 lpFee;         // 3 bytes
  
  const dataHex = data.slice(2);
  
  // Slices from right (offsets in characters from the end):
  // sqrtPriceX96: last 40 chars
  const sqrtPriceX96Hex = dataHex.slice(64 - 40);
  const sqrtPriceX96 = BigInt("0x" + sqrtPriceX96Hex);
  
  // tick: 6 chars before sqrtPriceX96 (chars 18 to 24)
  const tickHex = dataHex.slice(64 - 46, 64 - 40);
  let tick = parseInt("0x" + tickHex, 16);
  // handle negative 24-bit integer
  if (tick & 0x800000) {
    tick = tick - 0x1000000;
  }

  // protocolFee: 6 chars before tick
  const protocolFeeHex = dataHex.slice(64 - 52, 64 - 46);
  const protocolFee = parseInt("0x" + protocolFeeHex, 16);

  // lpFee: 6 chars before protocolFee
  const lpFeeHex = dataHex.slice(64 - 58, 64 - 52);
  const lpFee = parseInt("0x" + lpFeeHex, 16);

  console.log("Decoded Slot0 values:");
  console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);
  console.log(`  tick: ${tick}`);
  console.log(`  protocolFee: ${protocolFee}`);
  console.log(`  lpFee: ${lpFee}`);

  // Calculate actual price
  const price = (Number(sqrtPriceX96) / Math.pow(2, 96)) ** 2;
  console.log(`  Price (GRUSH per OKB or vice-versa): ${price}`);
  console.log(`  1.0001^tick: ${Math.pow(1.0001, tick)}`);
}

main().catch(console.error);
