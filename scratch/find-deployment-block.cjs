const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = "0x422fe165b2da990d18c6dca944b11dcd61519671";
  
  let low = 60000000;
  let high = await ethers.provider.getBlockNumber();
  
  console.log(`Binary searching block range [${low}, ${high}]...`);
  
  let deploymentBlock = high;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    try {
      const code = await ethers.provider.getCode(tokenAddress, mid);
      if (code !== "0x") {
        deploymentBlock = mid;
        high = mid - 1; // Try to find earlier block
      } else {
        low = mid + 1; // Contract not deployed yet
      }
    } catch (e) {
      // If the node doesn't support state queries at that block, we might get an error.
      // In that case, fall back to moving low up.
      low = mid + 1;
    }
  }
  
  console.log(`🎉 GRUSH deployed at block: ${deploymentBlock}`);
}

main().catch(console.error);
