/**
 * Update the AccessPass contract's imageUrl to point to the
 * production backend so wallets can resolve the NFT image.
 */
const { ethers } = require('ethers');
require('dotenv').config();

const ACCESS_PASS_ADDRESS = '0x953a03161A2e4be8E5e8405B74a254B336cdBe97';
const RPC = 'https://rpc.xlayer.tech';
const NEW_IMAGE_URL = 'https://goal-rush-backend-production.up.railway.app/access-pass.png';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const abi = [
    "function setImageUrl(string _newUrl) external",
    "function imageUrl() external view returns (string)"
  ];
  const contract = new ethers.Contract(ACCESS_PASS_ADDRESS, abi, wallet);

  const currentUrl = await contract.imageUrl();
  console.log(`Current imageUrl: ${currentUrl}`);
  console.log(`Setting to: ${NEW_IMAGE_URL}`);

  const tx = await contract.setImageUrl(NEW_IMAGE_URL);
  console.log(`TX submitted: ${tx.hash}`);
  await tx.wait();
  console.log('✅ imageUrl updated on-chain!');

  const verified = await contract.imageUrl();
  console.log(`Verified: ${verified}`);
}

main().catch(console.error);
