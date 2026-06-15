const { ethers } = require("ethers");

async function main() {
  const rpcProvider = new ethers.JsonRpcProvider("https://xlayer.drpc.org");
  const routerAddress = "0xB8332a105f2ea7F53Bd94554F74658Bf767f8D67";
  
  const abi = [
    "function hookAddress() external view returns (address)",
    "function grushToken() external view returns (address)"
  ];

  const router = new ethers.Contract(routerAddress, abi, rpcProvider);

  try {
    const code = await rpcProvider.getCode(routerAddress);
    console.log("Router Code Length:", code.length);
    
    if (code.length > 2) {
      const hookAddr = await router.hookAddress();
      const grushTok = await router.grushToken();
      console.log("Router's configured hookAddress:", hookAddr);
      console.log("Router's configured grushToken:", grushTok);
    } else {
      console.log("Router contract is NOT deployed at this address!");
    }
  } catch (err) {
    console.error("Error querying router:", err);
  }
}

main().catch(console.error);
