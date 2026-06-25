const { ethers } = require("hardhat");

async function main() {
  const NFT_ADDRESS = "0xd30b894bbD3185737c5D6a276367A4fEDF44de5C";
  const nft = new ethers.Contract(NFT_ADDRESS, [
    "function nextTokenId() view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getCard(uint256 tokenId) view returns (tuple(string username, string pos, uint8 overall, uint8 defi_iq, uint8 prediction_power, uint8 jackpot_luck, uint8 degen_level, uint8 swap_speed, uint8 x_factor, string card_type, uint256 mintTime))"
  ], ethers.provider);

  const nextId = await nft.nextTokenId();
  console.log(`Total minted: ${nextId - 1n} NFTs\n`);

  // Check last few minted tokens
  const start = nextId > 5n ? nextId - 5n : 1n;
  for (let i = start; i < nextId; i++) {
    try {
      const owner = await nft.ownerOf(i);
      const uri = await nft.tokenURI(i);
      const card = await nft.getCard(i);
      console.log(`--- Token #${i} ---`);
      console.log(`  Owner:    ${owner}`);
      console.log(`  Username: ${card.username}`);
      console.log(`  OVR:      ${card.overall}`);
      console.log(`  Type:     ${card.card_type}`);
      console.log(`  URI:      ${uri}`);
      
      // Test if the URI actually returns valid JSON
      try {
        const resp = await fetch(uri);
        const json = await resp.json();
        console.log(`  Image:    ${json.image || 'MISSING!'}`);
        console.log(`  Status:   ✅ Metadata loads correctly`);
      } catch (e) {
        console.log(`  Status:   ❌ METADATA FETCH FAILED: ${e.message}`);
      }
      console.log();
    } catch (e) {
      console.log(`Token #${i}: ${e.message}\n`);
    }
  }
}

main().catch(console.error);
