const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  
  // 1. Get proxy bytecode
  const code = await ethers.provider.getCode(hookAddress);
  console.log(`Proxy bytecode size: ${code.length}`);
  
  // 2. Read EIP-1967 implementation slot
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implData = await ethers.provider.getStorage(hookAddress, implSlot);
  console.log(`EIP-1967 implementation slot value: ${implData}`);
  
  // 3. Read other common proxy implementation slots/getters
  const slots = [
    "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723f4ee540290c319e", // beacon slot
    "0xc5f16f0f18c6d17b5f16f5c88b7f872166e4a2c5a297ee4a88f72bc97e16d418"  // admin slot
  ];
  for (const slot of slots) {
    const val = await ethers.provider.getStorage(hookAddress, slot);
    console.log(`Storage at ${slot}: ${val}`);
  }

  // Let's call implementation() if it exists
  try {
    const contract = await ethers.getContractAt([
      "function implementation() external view returns (address)"
    ], hookAddress);
    const implAddr = await contract.implementation();
    console.log(`implementation() returned: ${implAddr}`);
  } catch (e) {
    console.log("No implementation() view function");
  }

  // If EIP-1967 slot is not zero, that's our implementation!
  let implAddress = hookAddress;
  if (implData !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    implAddress = ethers.getAddress("0x" + implData.slice(26));
    console.log(`Implementation address: ${implAddress}`);
    const implCode = await ethers.provider.getCode(implAddress);
    console.log(`Implementation bytecode size: ${implCode.length}`);
  }
}

main().catch(console.error);
