/**
 * transfer-ownership.cjs
 * ─────────────────────────────────────────────────────────────
 * One-time script: transfers ownership of Hook + Router contracts
 * from the OLD wallet to the NEW wallet.
 *
 * Run ONCE with the OLD private key still in .env:
 *   npx hardhat run scripts/transfer-ownership.cjs --network xlayerMainnet
 *
 * After success, update PRIVATE_KEY in .env to the new key.
 */

'use strict';

const { ethers } = require('hardhat');

const NEW_OWNER      = '0xAe1B810fFB88855fFD967Dc274D9ba4fadd21990';
const HOOK_ADDRESS   = process.env.HOOK_ADDRESS   || '0x8bD62234113b1A860A09ABc9ECDaC86376E49DA9';
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || '0x66ef1ac1B70C6248422B9E30BdD498736d4a1A2B';

const TRANSFER_ABI = [
  'function owner() external view returns (address)',
  'function transferOwnership(address newOwner) external',
];

const ROUTER_ABI = [
  'function owner() external view returns (address)',
  'function transferOwnership(address newOwner) external',
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`\nSigning wallet : ${signer.address}`);
  console.log(`New owner      : ${NEW_OWNER}`);

  // ── Hook Contract ──────────────────────────────────────────
  console.log(`\n── Hook: ${HOOK_ADDRESS}`);
  const hook = new ethers.Contract(HOOK_ADDRESS, TRANSFER_ABI, signer);

  const currentHookOwner = await hook.owner();
  console.log(`Current owner  : ${currentHookOwner}`);

  if (currentHookOwner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error('❌ Your wallet is NOT the current Hook owner. Cannot transfer.');
    process.exit(1);
  }

  if (currentHookOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
    console.log('✅ Hook already owned by new wallet, skipping.');
  } else {
    console.log('Transferring Hook ownership...');
    const tx = await hook.transferOwnership(NEW_OWNER, { gasLimit: 100_000 });
    console.log(`TX submitted: ${tx.hash}`);
    await tx.wait(1);
    console.log('✅ Hook ownership transferred!');
  }

  // ── Router Contract ────────────────────────────────────────
  console.log(`\n── Router: ${ROUTER_ADDRESS}`);
  try {
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const currentRouterOwner = await router.owner();
    console.log(`Current owner  : ${currentRouterOwner}`);

    if (currentRouterOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
      console.log('✅ Router already owned by new wallet, skipping.');
    } else if (currentRouterOwner.toLowerCase() === signer.address.toLowerCase()) {
      console.log('Transferring Router ownership...');
      const tx2 = await router.transferOwnership(NEW_OWNER, { gasLimit: 100_000 });
      console.log(`TX submitted: ${tx2.hash}`);
      await tx2.wait(1);
      console.log('✅ Router ownership transferred!');
    } else {
      console.warn('⚠️  Signing wallet is not Router owner — skipping Router transfer.');
    }
  } catch (err) {
    console.warn(`⚠️  Router transfer skipped (${err.message})`);
  }

  console.log('\n🎉 Ownership transfer complete!');
  console.log('👉 Now update PRIVATE_KEY in your .env to the new key.');
  console.log('👉 Also update KEEPER_PRIVATE_KEY in Railway dashboard.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
