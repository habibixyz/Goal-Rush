const { ethers } = require("hardhat");

async function main() {
  // Get arguments from command line: [PoolManagerAddress, DeployerAddress]
  // Default values are set to X Layer Mainnet PoolManager and standard CREATE2 factory
  const poolManagerAddress = process.argv[2] || "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const deployerAddress = process.argv[3] || "0x4e59b44847b379578588920cA78FbF26c0B4956C";

  console.log(`Mining salt for WorldCupGoalRushHook...`);
  console.log(`PoolManager: ${poolManagerAddress}`);
  console.log(`CREATE2 Deployer/Factory: ${deployerAddress}`);

  // Get artifact
  const GoalRushHook = await ethers.getContractFactory("WorldCupGoalRushHook");
  const bytecode = GoalRushHook.bytecode;
  
  // Encode constructor arguments
  const abiCoder = new ethers.AbiCoder();
  const constructorArgs = abiCoder.encode(["address"], [poolManagerAddress]);
  
  // Full creation bytecode
  const creationCode = ethers.concat([bytecode, constructorArgs]);
  const creationCodeHash = ethers.keccak256(creationCode);

  console.log("Creation bytecode hash:", creationCodeHash);
  console.log("Searching for salt...");

  const start = Date.now();
  let saltNum = 0n;
  let found = false;
  let minedAddress = "";
  let minedSalt = "";

  // Target flags: beforeSwap (1 << 7) and afterSwap (1 << 6)
  // Mask: 0x3FFF (lowest 14 bits)
  // Target value: 0xC0 (0x80 | 0x40)
  const mask = 0x3FFFn;
  const targetValue = 0xC0n;

  while (!found) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(saltNum), 32);
    
    // CREATE2 address derivation formula:
    // keccak256(0xff + deployerAddress + salt + keccak256(creationCode))
    const hash = ethers.keccak256(
      ethers.concat([
        "0xff",
        deployerAddress,
        salt,
        creationCodeHash
      ])
    );
    
    const addressInt = BigInt(hash) & 0xffffffffffffffffffffffffffffffffffffffffn;
    
    if ((addressInt & mask) === targetValue) {
      found = true;
      minedAddress = ethers.getAddress(ethers.toBeHex(addressInt, 20));
      minedSalt = salt;
      break;
    }
    
    saltNum++;
    if (saltNum % 200000n === 0n) {
      console.log(`Checked ${saltNum} salts...`);
    }
  }

  const duration = (Date.now() - start) / 1000;
  console.log(`\n🎉 Success! Found matching salt in ${duration} seconds.`);
  console.log(`Checked ${saltNum} salts.`);
  console.log(`Mined Salt:    ${minedSalt}`);
  console.log(`Mined Address: ${minedAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
