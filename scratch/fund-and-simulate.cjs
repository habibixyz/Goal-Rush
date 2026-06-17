const { ethers } = require("ethers");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const HOOK = "0x4cb3D9931Dc1b95c4aEF1358503608e3f85340C0";
const RPC = "https://rpc.xlayer.tech";
const TARGET_WALLET = "0x95516932ede17e05d118b67130b2d2e1567c1037";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Funding wallet address:", wallet.address);
  
  // 1. Send 0.002 OKB to the Hook contract
  const fundAmount = ethers.parseEther("0.002");
  console.log(`Sending ${ethers.formatEther(fundAmount)} OKB to Hook contract...`);
  const tx = await wallet.sendTransaction({
    to: HOOK,
    value: fundAmount
  });
  console.log(`Transaction submitted: ${tx.hash}`);
  console.log("Waiting for block confirmation...");
  await tx.wait();
  console.log("Contract funded successfully!");

  // 2. Check Hook contract balance
  const contractBalance = await provider.getBalance(HOOK);
  console.log("New Hook Contract Balance:", ethers.formatEther(contractBalance), "OKB");

  // 3. Simulate claimJackpot call
  const abi = [
    "function claimJackpot(uint256 _matchId) external"
  ];
  const iface = new ethers.Interface(abi);
  const franceSenegalId = BigInt(ethers.id("espn_760432"));
  const txData = iface.encodeFunctionData("claimJackpot", [franceSenegalId]);

  console.log(`Simulating claimJackpot call from ${TARGET_WALLET}...`);
  try {
    const result = await provider.call({
      to: HOOK,
      from: TARGET_WALLET,
      data: txData
    });
    console.log("Simulation succeeded! Return data:", result);
  } catch (err) {
    console.log("Simulation failed!");
    console.log("Error details:", err);
  }
}

main().catch(console.error);
