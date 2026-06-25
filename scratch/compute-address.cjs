const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const nonce = 41; // Nonce of the router deployment
  const computedAddress = ethers.getCreateAddress({
    from: deployer.address,
    nonce: nonce
  });
  console.log(`Computed Router address for nonce ${nonce}: ${computedAddress}`);
  
  const code = await ethers.provider.getCode(computedAddress);
  console.log(`Code length at computed address: ${code.length}`);
}

main().catch(console.error);
