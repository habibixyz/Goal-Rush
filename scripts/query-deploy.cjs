const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Checking deployer:", deployer.address);
  
  const txCount = await hre.ethers.provider.getTransactionCount(deployer.address);
  console.log("Nonce:", txCount);

  // If a contract was deployed, it should be at the address generated from the deployer's address and nonce-1
  if (txCount > 0) {
    const contractAddress = hre.ethers.getCreateAddress({
      from: deployer.address,
      nonce: txCount - 1
    });
    console.log("Most recently deployed contract address:", contractAddress);
    
    // verify code
    const code = await hre.ethers.provider.getCode(contractAddress);
    if (code.length > 2) {
      console.log("Code exists at address!");
    } else {
      console.log("No code found at address.");
    }
  }
}

main().catch(console.error);
