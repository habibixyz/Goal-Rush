const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const ROUTER = "0xB7c9d225f7Ad8669fF31cc39D771b3365631110D";
const RPC = "https://rpc.xlayer.tech";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  const balance = await provider.getBalance(wallet.address);
  const latestBlock = await provider.getBlockNumber();
  console.log("Wallet address:", wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "OKB");
  console.log("Latest block:", latestBlock);
}

main().catch(console.error);
