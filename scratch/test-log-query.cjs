const { ethers } = require("ethers");
const dotenv = require("dotenv");
dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://rpc.xlayer.tech";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  
  const filter = {
    address: HOOK,
    fromBlock: 62494373,
    toBlock: "latest"
  };

  try {
    const logs = await provider.getLogs(filter);
    console.log(`Successfully fetched ${logs.length} logs in one query!`);
  } catch (e) {
    console.log("Error querying directly:", e.message);
  }
}

main().catch(console.error);
