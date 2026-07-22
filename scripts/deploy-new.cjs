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

const POOL_MANAGER  = '0x0000000000000000000000000000000000000000'; // Default Robinhood Chain Vault Manager
const GRUSH_TOKEN   = '0x0000000000000000000000000000000000000000'; // Set when token launches on Robinhood

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.0001')) {
    console.error('❌ Insufficient balance for deployment (need ~0.0001 ETH)');
    process.exit(1);
  }

  // ── 1. Deploy Hook ─────────────────────────────────────────
  console.log('\n📦 Deploying WorldCupGoalRushHook to Robinhood Chain...');
  const HookFactory = await ethers.getContractFactory('WorldCupGoalRushHook');
  const hook = await HookFactory.deploy(POOL_MANAGER === '0x0000000000000000000000000000000000000000' ? deployer.address : POOL_MANAGER);
  await hook.waitForDeployment();
  const HOOK_ADDRESS = await hook.getAddress();
  console.log(`✅ Hook deployed to Robinhood Chain: ${HOOK_ADDRESS}`);

  // ── 2. Deploy Router ───────────────────────────────────────
  console.log('\n📦 Deploying GoalRushPredictionRouter to Robinhood Chain...');
  const RouterFactory = await ethers.getContractFactory('GoalRushPredictionRouter');
  const router = await RouterFactory.deploy(HOOK_ADDRESS, GRUSH_TOKEN);
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log(`✅ Router deployed to Robinhood Chain: ${ROUTER_ADDRESS}`);

  // ── 3. Wire them together ──────────────────────────────────
  console.log('\n🔧 Setting PredictionRouter on Hook...');
  let tx = await hook.setPredictionRouter(ROUTER_ADDRESS);
  await tx.wait(1);
  console.log('✅ PredictionRouter set');

  // ── 4. Print summary ───────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  ROBINHOOD CHAIN CONTRACT ADDRESSES:');
  console.log('═══════════════════════════════════════════════');
  console.log(`  HOOK_ADDRESS   = '${HOOK_ADDRESS}'`);
  console.log(`  ROUTER_ADDRESS = '${ROUTER_ADDRESS}'`);
  console.log(`  Owner wallet   = ${deployer.address}`);
  console.log('═══════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
