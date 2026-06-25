/**
 * AccessPass Price Keeper
 * Automatically updates the on-chain mintPrice to always equal ~$10 worth of GRUSH
 * by fetching the live GRUSH/USD price from GeckoTerminal.
 */
const { ethers } = require('ethers');

const ACCESS_PASS_ADDRESS = '0x953a03161A2e4be8E5e8405B74a254B336cdBe97';
const GRUSH_POOL = '0xd639d7f0dc532caec7e31703281519f9e59a027a93ab71df3257ef9454fbef4f';
const GECKO_API = `https://api.geckoterminal.com/api/v2/networks/x-layer/pools/${GRUSH_POOL}`;
const RPC_URL = process.env.RPC_URL || 'https://rpc.xlayer.tech';
const TARGET_USD = 10; // $10 per mint
const DRIFT_THRESHOLD = 0.05; // Only update if price drifted >5%

const ABI = [
  "function setMintPrice(uint256 _newPrice) external",
  "function mintPrice() external view returns (uint256)"
];

async function updateAccessPassPrice() {
  const pk = process.env.PRIVATE_KEY || process.env.KEEPER_PRIVATE_KEY;
  if (!pk) {
    console.warn('[AccessPass Price] No PRIVATE_KEY found, skipping price update.');
    return;
  }

  try {
    // 1. Fetch current GRUSH price from GeckoTerminal
    const res = await fetch(GECKO_API);
    if (!res.ok) {
      console.warn(`[AccessPass Price] GeckoTerminal returned ${res.status}`);
      return;
    }
    const json = await res.json();
    const priceUsd = parseFloat(json?.data?.attributes?.base_token_price_usd);
    if (!priceUsd || priceUsd <= 0) {
      console.warn('[AccessPass Price] Invalid GRUSH price from API:', priceUsd);
      return;
    }

    // 2. Calculate the GRUSH amount for $10
    const targetGrush = Math.ceil(TARGET_USD / priceUsd);
    const targetWei = ethers.parseEther(String(targetGrush));

    // 3. Read current on-chain price
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(pk, provider);
    const contract = new ethers.Contract(ACCESS_PASS_ADDRESS, ABI, wallet);
    const currentPrice = await contract.mintPrice();
    const currentGrush = parseFloat(ethers.formatEther(currentPrice));

    // 4. Check if drift exceeds threshold
    const drift = Math.abs(targetGrush - currentGrush) / currentGrush;
    if (drift < DRIFT_THRESHOLD) {
      console.log(`[AccessPass Price] Price OK (${currentGrush.toLocaleString()} GRUSH, drift ${(drift * 100).toFixed(1)}% < ${DRIFT_THRESHOLD * 100}% threshold). No update needed.`);
      return;
    }

    // 5. Update on-chain
    console.log(`[AccessPass Price] Price drifted ${(drift * 100).toFixed(1)}%. Updating: ${currentGrush.toLocaleString()} → ${targetGrush.toLocaleString()} GRUSH ($${TARGET_USD} @ $${priceUsd.toFixed(8)}/GRUSH)`);
    const tx = await contract.setMintPrice(targetWei);
    await tx.wait();
    console.log(`[AccessPass Price] ✅ Updated to ${targetGrush.toLocaleString()} GRUSH. TX: ${tx.hash}`);
  } catch (err) {
    console.error('[AccessPass Price] Error updating price:', err.message || err);
  }
}

module.exports = { updateAccessPassPrice };
