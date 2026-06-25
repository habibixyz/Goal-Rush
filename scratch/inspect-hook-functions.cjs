const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  console.log("Testing bonding curve price functions on Hook:", hookAddress);

  const testCases = [
    { sig: "function calculateBuyPrice(uint256 amount) external view returns (uint256)", args: [ethers.parseEther("1")] },
    { sig: "function calculateSellPrice(uint256 amount) external view returns (uint256)", args: [ethers.parseEther("1")] },
    { sig: "function getBuyPrice(uint256 amount) external view returns (uint256)", args: [ethers.parseEther("1")] },
    { sig: "function getSellPrice(uint256 amount) external view returns (uint256)", args: [ethers.parseEther("1")] },
    { sig: "function getAmountOut(uint256 amountIn, bool zeroForOne) external view returns (uint256)", args: [ethers.parseEther("1"), true] },
    { sig: "function getAmountOut(uint256 amountIn, bool zeroForOne) external view returns (uint256)", args: [ethers.parseEther("1"), false] },
    { sig: "function getAmountIn(uint256 amountOut, bool zeroForOne) external view returns (uint256)", args: [ethers.parseEther("1"), true] },
    { sig: "function getAmountIn(uint256 amountOut, bool zeroForOne) external view returns (uint256)", args: [ethers.parseEther("1"), false] },
    { sig: "function quote(uint256 amount, bool zeroForOne) external view returns (uint256)", args: [ethers.parseEther("1"), true] },
    { sig: "function quote(uint256 amount, bool zeroForOne) external view returns (uint256)", args: [ethers.parseEther("1"), false] },
    { sig: "function getPrice() external view returns (uint256)", args: [] },
    { sig: "function currentPrice() external view returns (uint256)", args: [] },
    { sig: "function ethReserve() external view returns (uint256)", args: [] },
    { sig: "function tokenReserve() external view returns (uint256)", args: [] }
  ];

  for (const tc of testCases) {
    try {
      const contract = await ethers.getContractAt([tc.sig], hookAddress);
      const funcName = tc.sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName](...tc.args);
      console.log(`✅ Success for ${tc.sig} -> Result: ${res}`);
    } catch (e) {
      console.log(`❌ Failed for ${tc.sig.split(" ")[1].split("(")[0]}: ${e.message.split("\n")[0]}`);
    }
  }
}

main().catch(console.error);
