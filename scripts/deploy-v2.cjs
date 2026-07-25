'use strict';
/**
 * deploy-v2.cjs
 * ─────────────────────────────────────────────
 * Deploys WorldCupGoalRushHook v2 + GoalRushPredictionRouter
 * to X Layer Mainnet.
 *
 * v2 features:
 *   - 2% platform fee on jackpot claims
 *   - createMatch takes kickoffTime (not duration) → predictions open days ahead
 *
 * Run:
 *   npx hardhat run scripts/deploy-v2.cjs --network xlayerMainnet
 */

const { ethers } = require('hardhat');

// Placeholder PoolManager — X Layer doesn't have Uniswap V4 yet,
// so we use the deployer address to satisfy the non-zero check.
const POOL_MANAGER = '0x0000000000000000000000000000000000000000'; // replaced below

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} OKB`);

  if (balance < ethers.parseEther('0.0001')) {
    console.error('❌ Insufficient balance (need ~0.0001 OKB for deployment)');
    process.exit(1);
  }

  // ── 1. Deploy Hook v2 ──────────────────────────────────────
  console.log('\n📦 Deploying WorldCupGoalRushHook v2 (with 2% fee) to X Layer...');
  const HookFactory = await ethers.getContractFactory('WorldCupGoalRushHook');
  // Use deployer as poolManager placeholder so the require(!=0) passes
  const hook = await HookFactory.deploy(deployer.address);
  await hook.waitForDeployment();
  const HOOK_ADDRESS = await hook.getAddress();
  console.log(`✅ Hook v2 deployed: ${HOOK_ADDRESS}`);

  // Verify fee was set correctly
  const feeBps = await hook.platformFeeBps();
  console.log(`   Platform fee: ${feeBps}bps (${Number(feeBps)/100}%)`);

  // ── 2. Deploy Router ───────────────────────────────────────
  console.log('\n📦 Deploying GoalRushPredictionRouter to X Layer...');
  const RouterFactory = await ethers.getContractFactory('GoalRushPredictionRouter');
  const router = await RouterFactory.deploy(
    HOOK_ADDRESS,
    '0x0000000000000000000000000000000000000000' // GRUSH token
  );
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log(`✅ Router deployed: ${ROUTER_ADDRESS}`);

  // ── 3. Wire: set router on hook ────────────────────────────
  console.log('\n🔧 Wiring PredictionRouter on Hook...');
  let tx = await hook.setPredictionRouter(ROUTER_ADDRESS);
  await tx.wait(1);
  console.log('✅ PredictionRouter wired');

  // ── 4. Summary ─────────────────────────────────────────────
  const newBalance = await ethers.provider.getBalance(deployer.address);
  const spent = balance - newBalance;
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  X LAYER MAINNET — GoalRush v2 — CONTRACT ADDRESSES');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  HOOK_ADDRESS   = '${HOOK_ADDRESS}'`);
  console.log(`  ROUTER_ADDRESS = '${ROUTER_ADDRESS}'`);
  console.log(`  Owner wallet   = ${deployer.address}`);
  console.log(`  Gas spent      = ${ethers.formatEther(spent)} ETH`);
  console.log(`  Remaining bal  = ${ethers.formatEther(newBalance)} ETH`);
  console.log(`  Platform fee   = ${Number(feeBps)/100}% (adjustable via setPlatformFee())`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n⚠️  NOW UPDATE THESE IN:');
  console.log('   src/App.jsx          → HOOK_ADDRESS, ROUTER_ADDRESS');
  console.log('   backend/src/keeper.js → HOOK_ADDRESS default');
  console.log('   scripts/keeper.cjs    → HOOK_ADDRESS default');
  console.log('   backend/src/goalrush-ai-agent.cjs → both');
  console.log('   README.md             → deployment addresses');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
