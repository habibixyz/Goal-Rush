const { ethers } = require("ethers");
const dotenv = require("dotenv");
dotenv.config();

const RPC = "https://rpc.xlayer.tech";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const txCount = await provider.getTransactionCount(wallet.address, "latest");
  console.log("Wallet address:", wallet.address);
  console.log("Transaction count (nonce):", txCount);
}

main().catch(console.error);
