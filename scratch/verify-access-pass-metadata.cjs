/**
 * Verify the AccessPass NFT metadata is correct
 */
const { ethers } = require('ethers');

const ACCESS_PASS_ADDRESS = '0x953a03161A2e4be8E5e8405B74a254B336cdBe97';
const RPC = 'https://rpc.xlayer.tech';

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const abi = [
    "function totalSupply() view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function imageUrl() view returns (string)",
    "function mintPrice() view returns (uint256)"
  ];
  const contract = new ethers.Contract(ACCESS_PASS_ADDRESS, abi, provider);

  const supply = await contract.totalSupply();
  console.log(`Total supply: ${supply}`);
  console.log(`Image URL: ${await contract.imageUrl()}`);
  console.log(`Mint price: ${ethers.formatEther(await contract.mintPrice())} GRUSH`);

  if (supply > 0n) {
    const uri = await contract.tokenURI(1);
    // Decode base64 JSON
    const jsonStr = atob(uri.split('base64,')[1]);
    const metadata = JSON.parse(jsonStr);
    console.log('\nToken #1 Metadata:');
    console.log(JSON.stringify(metadata, null, 2));
  } else {
    console.log('\nNo tokens minted yet. Metadata will resolve when first token is minted.');
    console.log('Preview metadata:');
    console.log(JSON.stringify({
      name: "GoalRush VIP Access Pass #1",
      description: "Guarantees exclusive gated access to VIP prediction pools and zero-fee token swaps on the GoalRush protocol.",
      image: await contract.imageUrl(),
      attributes: [
        { trait_type: "Tier", value: "VIP Access" },
        { trait_type: "Supply", value: "1000" }
      ]
    }, null, 2));
  }
}

main().catch(console.error);
