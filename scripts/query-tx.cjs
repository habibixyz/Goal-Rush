const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x2e20599c028adf80589c9f1f6b430f66b01b955c14f18f93732d1812d5dd29c4";
  const tx = await ethers.provider.getTransaction(txHash);
  
  try {
    const result = await ethers.provider.call({
      to: tx.to,
      data: tx.data,
      from: tx.from,
      value: tx.value,
      gasLimit: tx.gasLimit,
    });
    console.log("Call result:", result);
  } catch (err) {
    console.error("Revert reason:", err);
  }
}

main().catch(console.error);
