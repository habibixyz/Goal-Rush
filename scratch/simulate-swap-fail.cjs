const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const userAddress = "0xAe1B810fFB88855fFD967Dc274D9ba4fadd21990";

  const hookAbi = [
    "function buy(address payer, address recipient, uint256 minTokensOut) external payable returns (uint256 tokensOut)",
    "function quoteBuy(uint256 okbIn) external view returns (tuple(uint256 grossOkbIn, uint256 fee, uint256 effectiveOkbIn, uint256 oldOkbCum, uint256 newOkbCum, uint256 oldMinted, uint256 newMinted, uint256 tokensOut, uint16 burnTaxBps, uint256 grossTokensOut, uint256 burnTaxTokens) quote)",
    "function graduated() external view returns (bool)"
  ];

  const hook = new ethers.Contract(hookAddress, hookAbi, ethers.provider);

  console.log("Simulating with minTokensOut = 0:");
  const valueGuesses = ["0.0001", "0.001", "0.01"];
  for (const val of valueGuesses) {
    console.log(`\nSimulating buy with value: ${val} OKB, minTokensOut = 0`);
    try {
      const txData = hook.interface.encodeFunctionData("buy", [userAddress, userAddress, 0n]);
      const res = await ethers.provider.call({
        to: hookAddress,
        from: userAddress,
        data: txData,
        value: ethers.parseEther(val)
      });
      console.log(`Result with ${val} OKB:`, res);
    } catch (e) {
      console.error(`Reverted with ${val} OKB:`, e.message);
      if (e.data) {
        console.error("Revert data:", e.data);
      }
    }
  }
}

main().catch(console.error);
