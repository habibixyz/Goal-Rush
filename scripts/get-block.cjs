const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const latestBlock = await rpcProvider.getBlockNumber();
  console.log("Latest Block:", latestBlock);
}

main().catch(console.error);
