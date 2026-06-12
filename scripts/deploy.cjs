const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} native gas token`);

  // Target PoolManager and CREATE2 Deployer addresses
  // By default, using X Layer Mainnet PoolManager & Standard CREATE2 factory
  const poolManagerAddress = process.argv[2] || "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const deployerAddress = process.argv[3] || "0x4e59b44847b379578588920cA78FbF26c0B4956C";
  const salt = process.argv[4];

  if (!salt) {
    console.error("Error: Please provide the mined salt as the 3rd argument.");
    console.error("Example: npx hardhat run scripts/deploy.cjs [PoolManager] [Deployer] [MinedSalt]");
    process.exit(1);
  }

  console.log(`PoolManager: ${poolManagerAddress}`);
  console.log(`CREATE2 Deployer/Factory: ${deployerAddress}`);
  console.log(`Salt: ${salt}`);

  // Get contract factory & bytecode
  const GoalRushHook = await ethers.getContractFactory("WorldCupGoalRushHook");
  const bytecode = GoalRushHook.bytecode;
  
  // Encode constructor arguments
  const abiCoder = new ethers.AbiCoder();
  const constructorArgs = abiCoder.encode(["address"], [poolManagerAddress]);
  
  // Full creation bytecode
  const creationCode = ethers.concat([bytecode, constructorArgs]);

  // Derive target address to verify
  const creationCodeHash = ethers.keccak256(creationCode);
  const derivedAddressHash = ethers.keccak256(
    ethers.concat([
      "0xff",
      deployerAddress,
      salt,
      creationCodeHash
    ])
  );
  const derivedAddress = ethers.getAddress(ethers.toBeHex(BigInt(derivedAddressHash) & 0xffffffffffffffffffffffffffffffffffffffffn, 20));
  
  console.log(`Target Hook Address to be deployed: ${derivedAddress}`);

  // Check if already deployed
  const code = await ethers.provider.getCode(derivedAddress);
  if (code !== "0x") {
    console.log("Contract already deployed at this address!");
    process.exit(0);
  }

  // Send deployment transaction to CREATE2 factory
  console.log("Sending deployment transaction to CREATE2 Factory...");
  const txData = ethers.concat([salt, creationCode]);
  const tx = await deployer.sendTransaction({
    to: deployerAddress,
    data: txData,
  });

  console.log(`Transaction submitted. Hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Transaction mined! Block: ${receipt.blockNumber}`);

  // Double check code exists
  const finalCode = await ethers.provider.getCode(derivedAddress);
  if (finalCode !== "0x") {
    console.log(`🎉 Successfully deployed WorldCupGoalRushHook to: ${derivedAddress}`);
  } else {
    console.error("Failed to deploy hook!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
