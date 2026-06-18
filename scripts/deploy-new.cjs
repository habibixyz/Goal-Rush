/**
 * deploy-new.cjs
 * ─────────────────────────────────────────────
 * Deploys WorldCupGoalRushHook + GoalRushPredictionRouter
 * using the CURRENT private key in .env (new key).
 * 
 * Run:
 *   npx hardhat run scripts/deploy-new.cjs --network xlayerMainnet
 */

'use strict';

const { ethers } = require('hardhat');

const POOL_MANAGER  = '0x360e68faccca8ca495c1b759fd9eee466db9fb32'; // X Layer mainnet
const GRUSH_TOKEN   = '0x422fe165b2da990d18c6dca944b11dcd61519671'; // existing GRUSH token

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} OKB`);

  if (balance < ethers.parseEther('0.005')) {
    console.error('❌ Insufficient balance for deployment (need ~0.005 OKB)');
    process.exit(1);
  }

  // ── 1. Deploy Hook ─────────────────────────────────────────
  console.log('\n📦 Deploying WorldCupGoalRushHook...');
  const HookFactory = await ethers.getContractFactory('WorldCupGoalRushHook');
  const hook = await HookFactory.deploy(POOL_MANAGER);
  await hook.waitForDeployment();
  const HOOK_ADDRESS = await hook.getAddress();
  console.log(`✅ Hook deployed to: ${HOOK_ADDRESS}`);

  // ── 2. Deploy Router ───────────────────────────────────────
  console.log('\n📦 Deploying GoalRushPredictionRouter...');
  const RouterFactory = await ethers.getContractFactory('GoalRushPredictionRouter');
  const router = await RouterFactory.deploy(HOOK_ADDRESS, GRUSH_TOKEN);
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log(`✅ Router deployed to: ${ROUTER_ADDRESS}`);

  // ── 3. Wire them together ──────────────────────────────────
  console.log('\n🔧 Setting PredictionRouter on Hook...');
  let tx = await hook.setPredictionRouter(ROUTER_ADDRESS);
  await tx.wait(1);
  console.log('✅ PredictionRouter set');

  console.log('🔧 Setting GRUSH Token on Hook...');
  tx = await hook.setGrushToken(GRUSH_TOKEN);
  await tx.wait(1);
  console.log('✅ GRUSH Token set');

  // ── 4. Print summary ───────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  NEW CONTRACT ADDRESSES — update these now:');
  console.log('═══════════════════════════════════════════════');
  console.log(`  HOOK_ADDRESS   = '${HOOK_ADDRESS}'`);
  console.log(`  ROUTER_ADDRESS = '${ROUTER_ADDRESS}'`);
  console.log(`  GRUSH_TOKEN    = '${GRUSH_TOKEN}'  (unchanged)`);
  console.log(`  Owner wallet   = ${deployer.address}`);
  console.log('═══════════════════════════════════════════════');
  console.log('\n👉 Update src/App.jsx, scripts/keeper.cjs,');
  console.log('   goal rush back/.../keeper.js, and Railway env vars.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
