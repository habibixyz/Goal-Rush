const { ethers } = require("hardhat");

async function checkAddress(name, address) {
  const code = await ethers.provider.getCode(address);
  console.log(`${name} (${address}):`);
  if (code === "0x") {
    console.log("  ❌ NOT DEPLOYED (no code)");
    return null;
  }
  console.log(`  ✅ Deployed (code size: ${code.length} chars)`);
  return code;
}

async function checkHook(address) {
  const code = await checkAddress("Hook", address);
  if (!code) return;
  try {
    const hook = await ethers.getContractAt([
      "function activeMatchId() external view returns (uint256)",
      "function predictionRouter() external view returns (address)",
      "function grushToken() external view returns (address)",
      "function owner() external view returns (address)"
    ], address);
    
    const activeMatchId = await hook.activeMatchId();
    const predictionRouter = await hook.predictionRouter();
    const grushToken = await hook.grushToken();
    const owner = await hook.owner();
    console.log(`  - activeMatchId: ${activeMatchId}`);
    console.log(`  - predictionRouter: ${predictionRouter}`);
    console.log(`  - grushToken: ${grushToken}`);
    console.log(`  - owner: ${owner}`);
  } catch (err) {
    console.log(`  - ❌ Error querying hook: ${err.message}`);
  }
}

async function checkRouter(address) {
  const code = await checkAddress("Router", address);
  if (!code) return;
  try {
    const router = await ethers.getContractAt([
      "function hookAddress() external view returns (address)",
      "function grushToken() external view returns (address)",
      "function owner() external view returns (address)"
    ], address);
    
    const hookAddress = await router.hookAddress();
    const grushToken = await router.grushToken();
    let owner = "N/A";
    try {
      owner = await router.owner();
    } catch (_) {}
    console.log(`  - hookAddress: ${hookAddress}`);
    console.log(`  - grushToken: ${grushToken}`);
    console.log(`  - owner: ${owner}`);
  } catch (err) {
    console.log(`  - ❌ Error querying router: ${err.message}`);
  }
}

async function main() {
  console.log("--- Checking contracts configured in src/App.jsx ---");
  await checkHook("0xf568f5343116D369a7C7a50E69C7F89B79A65E37");
  await checkRouter("0x462F4521ac71E4502E7C7C8856d39823df03913E");

  console.log("\n--- Checking contracts configured in scripts/transfer-ownership.cjs / setup-hook.cjs ---");
  await checkHook("0xC907030AeCd8fC81B19678cDD08DCF96cD9380c0");
  await checkRouter("0x5Ae40D89c38109764B91eE97F41deE4F1E86b26c");

  console.log("\n--- Checking other referenced contracts ---");
  await checkHook("0x66ef1ac1B70C6248422B9E30BdD498736d4a1A2B");
  await checkHook("0x9bA0a504dbdBbe96300E56D69FCbd5154b10C0c0");
  await checkRouter("0xB8332a105f2ea7F53Bd94554F74658Bf767f8D67");
}

main().catch(console.error);
