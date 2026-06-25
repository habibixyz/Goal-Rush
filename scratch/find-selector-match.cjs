const { ethers } = require("hardhat");

const candidateNames = [
  "graduate",
  "graduation",
  "claim",
  "initialize",
  "createPool",
  "addLiquidity",
  "onBuy",
  "onSell",
  "executeGraduation",
  "swap",
  "execute",
  "settle",
  "finish",
  "complete",
  "close",
  "end",
  "init",
  "lock",
  "unlock",
  "migrate",
  "migrateLiquidity",
  "addLiquidityV4",
  "initializeV4",
  "graduated"
];

const paramCombinations = [
  "",
  "()",
  "(address)",
  "(uint256)",
  "(uint256,uint256)",
  "(address,address)",
  "(address,uint256)",
  "(uint256,address)",
  "(bool)",
  "(string)"
];

async function main() {
  const targetSelector = "870b8855";
  console.log(`Searching for matches for selector: 0x${targetSelector}...`);

  for (const name of candidateNames) {
    for (const params of paramCombinations) {
      let sig = name;
      if (params === "") {
        sig = name + "()";
      } else {
        sig = name + params;
      }
      
      const hash = ethers.id(sig);
      const selector = hash.slice(2, 10);
      if (selector === targetSelector) {
        console.log(`🎉 MATCH FOUND!`);
        console.log(`Signature: ${sig}`);
        console.log(`Selector: 0x${selector}`);
        return;
      }
    }
  }

  console.log("❌ No match found with candidate names list.");
}

main().catch(console.error);
