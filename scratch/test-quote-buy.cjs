const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  
  const abi = [
    "function quoteBuy(uint256 okbIn) external view returns (tuple(uint256 grossOkbIn, uint256 fee, uint256 effectiveOkbIn, uint256 oldOkbCum, uint256 newOkbCum, uint256 oldMinted, uint256 newMinted, uint256 tokensOut, uint16 burnTaxBps, uint256 grossTokensOut, uint256 burnTaxTokens) quote)"
  ];

  const hook = new ethers.Contract(hookAddress, abi, ethers.provider);
  const okbIn = ethers.parseEther("0.001");
  console.log("Querying quoteBuy for 0.001 OKB...");

  try {
    const res = await hook.quoteBuy(okbIn);
    console.log("Success! Full result:");
    console.log(res);
    console.log(`Tokens Out: ${ethers.formatEther(res.tokensOut)} GRUSH`);
  } catch (err) {
    console.error("Error calling quoteBuy:", err);
  }
}

main().catch(console.error);
