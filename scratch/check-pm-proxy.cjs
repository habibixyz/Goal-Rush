const { ethers } = require("hardhat");

async function main() {
  const address = "0xa0b4EC3D6e3dac466572ef85582FC6233aA13a03";
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  
  const implData = await ethers.provider.getStorage(address, implSlot);
  console.log(`Contract implementation slot value: ${implData}`);

  if (implData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    const implAddr = ethers.getAddress("0x" + implData.slice(26));
    console.log(`Implementation address: ${implAddr}`);
    const implCode = await ethers.provider.getCode(implAddr);
    console.log(`Implementation bytecode size: ${implCode.length}`);
  }
}

main().catch(console.error);
