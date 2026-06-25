const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying Access Pass with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  const GRUSH_ADDRESS = "0x422fe165b2da990d18c6dca944b11dcd61519671";

  const AccessPass = await hre.ethers.getContractFactory("GoalRushAccessPass");
  const pass = await AccessPass.deploy(GRUSH_ADDRESS);

  await pass.waitForDeployment();

  const address = await pass.getAddress();
  console.log("GoalRushAccessPass deployed to:", address);

  // Print summary
  console.log(`\nDeployment Summary:`);
  console.log(`-------------------`);
  console.log(`Access Pass: ${address}`);
  console.log(`Owner:       ${deployer.address}`);
  console.log(`Grush Token: ${GRUSH_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
