const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const code = await ethers.provider.getCode(tokenAddress);
  console.log(`Token Address: ${tokenAddress}`);
  if (code === "0x") {
    console.log("❌ Token is NOT deployed!");
    return;
  }
  console.log(`✅ Token is deployed (code size: ${code.length})`);

  try {
    const token = await ethers.getContractAt([
      "function name() external view returns (string)",
      "function symbol() external view returns (string)",
      "function decimals() external view returns (uint8)",
      "function totalSupply() external view returns (uint256)"
    ], tokenAddress);

    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    const totalSupply = await token.totalSupply();

    console.log(`  - Name: ${name}`);
    console.log(`  - Symbol: ${symbol}`);
    console.log(`  - Decimals: ${decimals}`);
    console.log(`  - Total Supply: ${ethers.formatEther(totalSupply)} ${symbol}`);
  } catch (err) {
    console.error("❌ Error querying token:", err.message);
  }
}

main().catch(console.error);
