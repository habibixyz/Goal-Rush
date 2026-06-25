const { ethers } = require("hardhat");

async function main() {
  const factoryAddress = "0xBf2334d853D1239B093934c2BCB7a78869d1F287";
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  
  const implData = await ethers.provider.getStorage(factoryAddress, implSlot);
  console.log(`Factory implementation slot value: ${implData}`);

  if (implData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    const implAddr = ethers.getAddress("0x" + implData.slice(26));
    console.log(`Factory implementation address: ${implAddr}`);
    const implCode = await ethers.provider.getCode(implAddr);
    console.log(`Factory implementation bytecode size: ${implCode.length}`);
  }
}

main().catch(console.error);
