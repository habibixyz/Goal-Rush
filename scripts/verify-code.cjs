const { ethers } = require("hardhat");

async function main() {
  const address = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
  const code = await ethers.provider.getCode(address);
  console.log("Code length:", code.length);
  console.log("Code:", code);
}

main().catch(console.error);
