/**
 * Check if we have owner/withdrawal access on the AccessPass contract
 */
const { ethers } = require('ethers');
require('dotenv').config();

const ACCESS_PASS_ADDRESS = '0x953a03161A2e4be8E5e8405B74a254B336cdBe97';
const GRUSH_TOKEN_ADDRESS = '0x422fe165b2da990d18c6dca944b11dcd61519671';
const RPC = 'https://rpc.xlayer.tech';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const abi = [
    "function owner() view returns (address)",
    "function mintPrice() view returns (uint256)",
    "function totalSupply() view returns (uint256)"
  ];
  const contract = new ethers.Contract(ACCESS_PASS_ADDRESS, abi, provider);

  const tokenAbi = ["function balanceOf(address) view returns (uint256)"];
  const grush = new ethers.Contract(GRUSH_TOKEN_ADDRESS, tokenAbi, provider);

  const owner = await contract.owner();
  const ourAddress = wallet.address;
  const isOwner = owner.toLowerCase() === ourAddress.toLowerCase();
  const contractGrushBalance = await grush.balanceOf(ACCESS_PASS_ADDRESS);
  const supply = await contract.totalSupply();
  const mintPrice = await contract.mintPrice();

  console.log(`Contract owner:    ${owner}`);
  console.log(`Our wallet:        ${ourAddress}`);
  console.log(`We are owner:      ${isOwner ? '✅ YES' : '❌ NO'}`);
  console.log(`Total minted:      ${supply}`);
  console.log(`Mint price:        ${ethers.formatEther(mintPrice)} GRUSH`);
  console.log(`GRUSH in contract: ${ethers.formatEther(contractGrushBalance)} GRUSH`);
  
  if (isOwner) {
    console.log('\n✅ We CAN call withdrawGrush() to extract accumulated GRUSH from the contract.');
  } else {
    console.log('\n❌ We are NOT the owner. Cannot withdraw funds.');
  }
}

main().catch(console.error);
