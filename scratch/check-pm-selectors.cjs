const { ethers } = require("hardhat");

async function main() {
  const pmAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  
  // Let's check if it's a proxy
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implData = await ethers.provider.getStorage(pmAddress, implSlot);
  console.log(`PoolManager implementation slot: ${implData}`);

  const code = await ethers.provider.getCode(pmAddress);
  console.log(`PoolManager bytecode length: ${code.length}`);

  // Standard V4 selectors
  const selectors = {
    "getSlot0": ethers.id("getSlot0(bytes32)").slice(2, 10),
    "getLiquidity": ethers.id("getLiquidity(bytes32)").slice(2, 10),
    "initialize": ethers.id("initialize(tuple(address,address,uint24,int24,address),uint160)").slice(2, 10),
    "modifyLiquidity": ethers.id("modifyLiquidity(tuple(address,address,uint24,int24,address),tuple(int24,int24,int256,bytes32),bytes)").slice(2, 10),
    "swap": ethers.id("swap(tuple(address,address,uint24,int24,address),tuple(bool,int256,uint160),bytes)").slice(2, 10),
    "pools": ethers.id("pools(bytes32)").slice(2, 10),
  };

  for (const [name, sel] of Object.entries(selectors)) {
    const exists = code.includes(sel);
    console.log(`Selector ${name} (0x${sel}): ${exists ? "FOUND" : "NOT FOUND"}`);
  }
}

main().catch(console.error);
