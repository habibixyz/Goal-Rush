'use strict';

const { ethers } = require('hardhat');

// Existing Hook v2 address on Robinhood Chain Mainnet
const HOOK_ADDRESS = '0x737b827dF98aC380C447dC54aCcDF415B01DB6a6';

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther('0.0001')) {
    console.error('❌ Insufficient balance for deployment (need ~0.0001 ETH)');
    process.exit(1);
  }

  // ── 1. Deploy Router v2 with batchPredictWithETH ────────────
  console.log('\n📦 Deploying GoalRushPredictionRouter v2 (with batch support)...');
  const RouterFactory = await ethers.getContractFactory('GoalRushPredictionRouter');
  const router = await RouterFactory.deploy(
    HOOK_ADDRESS,
    '0x0000000000000000000000000000000000000000' // GRUSH token placeholder
  );
  await router.waitForDeployment();
  const ROUTER_ADDRESS = await router.getAddress();
  console.log(`✅ Router v2 deployed: ${ROUTER_ADDRESS}`);

  // ── 2. Wire router to hook ─────────────────────────────────
  console.log('\n🔧 Setting new PredictionRouter on existing Hook...');
  const HookFactory = await ethers.getContractFactory('WorldCupGoalRushHook');
  const hook = HookFactory.attach(HOOK_ADDRESS);
  const tx = await hook.setPredictionRouter(ROUTER_ADDRESS);
  await tx.wait(1);
  console.log('✅ PredictionRouter set successfully!');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  GoalRush Batch Router v2 Deployed');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ROUTER_ADDRESS = '${ROUTER_ADDRESS}'`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
