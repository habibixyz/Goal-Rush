const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x5b13c480dcd4f19deb523004f03997708191dc7e29db9b8be616586e49ebe767";
  const tx = await ethers.provider.getTransaction(txHash);

  console.log("=== Graduation TX Calldata Analysis ===");
  console.log(`Selector: ${tx.data.slice(0, 10)}`);
  
  // Strip selector, decode remaining as raw 32-byte words
  const rawData = tx.data.slice(10);
  const wordCount = rawData.length / 64;
  console.log(`Total words: ${wordCount}`);
  
  for (let i = 0; i < wordCount; i++) {
    const word = rawData.slice(i * 64, (i + 1) * 64);
    const asAddress = "0x" + word.slice(24);
    const asUint = BigInt("0x" + word);
    const asInt24 = parseInt(word.slice(58), 16);
    const signedInt24 = asInt24 > 0x7FFFFF ? asInt24 - 0x1000000 : asInt24;
    
    console.log(`Word ${i}: 0x${word}`);
    console.log(`  as address: ${asAddress}`);
    console.log(`  as uint256: ${asUint}`);
    if (asUint < 1000000n) console.log(`  as small number: ${asUint}`);
    if (Math.abs(signedInt24) < 1000000) console.log(`  last 3 bytes as int24: ${signedInt24}`);
  }

  // Now let's check common Eulr graduation signatures
  const candidates = [
    "graduate(address,address,uint24,int24,address,uint160,bytes)",
    "graduate(tuple(address,address,uint24,int24,address),uint160,bytes)",
    "graduate(tuple(address,address,uint24,int24,address),uint160)",
    "onGraduate(address,address,uint24,int24,address,uint160)",
    "afterBuy(address,address,uint256,uint256)",
  ];
  
  for (const sig of candidates) {
    const sel = ethers.id(sig).slice(0, 10);
    if (sel === tx.data.slice(0, 10)) {
      console.log(`\n🎉 Selector match: ${sig}`);
    }
  }
}

main().catch(console.error);
