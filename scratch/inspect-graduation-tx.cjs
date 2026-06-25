const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x5b13c480dcd4f19deb523004f03997708191dc7e29db9b8be616586e49ebe767";
  const tx = await ethers.provider.getTransaction(txHash);

  console.log(`Transaction details for ${txHash}:`);
  console.log(`  From: ${tx.from}`);
  console.log(`  To: ${tx.to}`);
  console.log(`  Value: ${ethers.formatEther(tx.value)} OKB`);
  console.log(`  Method Selector: ${tx.data.slice(0, 10)}`);
  console.log(`  Data Length: ${tx.data.length} chars`);

  const methods = {
    "0x153e66e6": "buy(address payer, address recipient, uint256 minTokensOut)",
    "0x6854580b": "sell(address payer, address recipient, uint256 tokensIn, uint256 minOkbOut)",
    "0xe5819dcf": "graduate()",
    "0x425ef84b": "initializePool()",
  };
  const selector = tx.data.slice(0, 10);
  console.log(`  Decoded selector: ${methods[selector] || "unknown"}`);
  
  const addresses = [
    tx.to,
    "0xa0b4EC3D6e3dac466572ef85582FC6233aA13a03",
    "0x52cf44Cd62F56E194E0ef980Db0971e9aA526BC0",
    "0x360e68faccca8ca495c1b759fd9eee466db9fb32"
  ];
  for (const addr of addresses) {
    const code = await ethers.provider.getCode(addr);
    console.log(`Address ${addr} bytecode size: ${code.length}`);
  }
}

main().catch(console.error);
