/**
 * Set the AccessPass mint price to $10 worth of GRUSH
 * Current GRUSH price: ~$0.00008467
 * $10 / $0.00008467 ≈ 118,103 GRUSH
 */
const { ethers } = require('ethers');
require('dotenv').config();

const ACCESS_PASS_ADDRESS = '0x953a03161A2e4be8E5e8405B74a254B336cdBe97';
const RPC = 'https://rpc.xlayer.tech';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const abi = [
    "function setMintPrice(uint256 _newPrice) external",
    "function mintPrice() external view returns (uint256)",
    "function owner() external view returns (address)"
  ];
  const contract = new ethers.Contract(ACCESS_PASS_ADDRESS, abi, wallet);

  // Read current price
  const currentPrice = await contract.mintPrice();
  console.log(`Current mint price: ${ethers.formatEther(currentPrice)} GRUSH`);

  // $10 at $0.00008467/GRUSH = ~118,103 GRUSH
  const newPrice = ethers.parseEther('118100');
  console.log(`Setting new mint price to: ${ethers.formatEther(newPrice)} GRUSH (~$10)`);

  const tx = await contract.setMintPrice(newPrice);
  console.log(`TX submitted: ${tx.hash}`);
  await tx.wait();
  console.log('✅ Mint price updated successfully!');

  // Verify
  const updatedPrice = await contract.mintPrice();
  console.log(`Verified new price: ${ethers.formatEther(updatedPrice)} GRUSH`);
}

main().catch(console.error);
