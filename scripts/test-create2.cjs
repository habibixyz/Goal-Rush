const { ethers } = require("hardhat");

async function main() {
  const [owner] = await ethers.getSigners();
  console.log("Starting CREATE2 Local Verification Test...");

  // 1. Deploy Create2Deployer
  console.log("\nDeploying Create2Deployer factory...");
  const Create2Deployer = await ethers.getContractFactory("Create2Deployer");
  const deployer = await Create2Deployer.deploy();
  await deployer.waitForDeployment();
  const deployerAddress = await deployer.getAddress();
  console.log("Create2Deployer deployed to:", deployerAddress);

  // 2. Mock PoolManager Address
  const poolManagerAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";

  // 3. Mine salt for the deployed Create2Deployer address
  console.log("\nMining salt...");
  const GoalRushHook = await ethers.getContractFactory("WorldCupGoalRushHook");
  const bytecode = GoalRushHook.bytecode;
  const abiCoder = new ethers.AbiCoder();
  const constructorArgs = abiCoder.encode(["address"], [poolManagerAddress]);
  const creationCode = ethers.concat([bytecode, constructorArgs]);
  const creationCodeHash = ethers.keccak256(creationCode);

  let saltNum = 0n;
  let found = false;
  let minedAddress = "";
  let minedSalt = "";

  const mask = 0x3FFFn;
  const targetValue = 0xC0n;

  while (!found) {
    const salt = ethers.zeroPadValue(ethers.toBeHex(saltNum), 32);
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
  }

  console.log(`Found salt:    ${minedSalt}`);
  console.log(`Target Address: ${minedAddress}`);

  // 4. Deploy using Create2Deployer
  console.log("\nDeploying WorldCupGoalRushHook using CREATE2 deployer...");
  const tx = await deployer.deploy(creationCode, minedSalt);
  const receipt = await tx.wait();
  console.log("Deployment transaction mined!");

  // 5. Verify the address is correct
  const code = await ethers.provider.getCode(minedAddress);
  if (code !== "0x") {
    console.log(`\n🎉 SUCCESS! Contract is deployed at the target mined address: ${minedAddress}`);
    // Check lowest 14 bits
    const addressInt = BigInt(minedAddress);
    const bits = addressInt & mask;
    console.log(`Lowest 14 bits value (hex): 0x${bits.toString(16)} (Expected: 0xc0)`);
    if (bits === targetValue) {
      console.log("Hook address permission flags are VALID!");
    } else {
      console.error("Hook address permission flags are INVALID!");
    }
  } else {
    console.error("Failed: No code deployed at mined address.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
