const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const factoryAddress = "0xBf2334d853D1239B093934c2BCB7a78869d1F287";
  const pmAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";

  const tokenAbi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)"
  ];
  const token = new ethers.Contract(tokenAddress, tokenAbi, ethers.provider);

  const targets = {
    "Hook": hookAddress,
    "Factory": factoryAddress,
    "PoolManager": pmAddress
  };

  for (const [name, addr] of Object.entries(targets)) {
    try {
      const bal = await token.balanceOf(addr);
      console.log(`${name} (${addr}) balance: ${ethers.formatEther(bal)} GRUSH`);
    } catch (e) {
      console.log(`Failed to query ${name}:`, e.message);
    }
  }
}

main().catch(console.error);
