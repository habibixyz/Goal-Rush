const { ethers } = require("hardhat");

async function main() {
  const address = "0xcF1EAFC6928dC385A342E7C6491d371d2871458b";
  const tokenId = 3617;

  console.log(`Inspecting contract ${address} as PositionManager / ERC721...`);

  const signatures = [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, bytes32 poolId, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
  ];

  for (const sig of signatures) {
    try {
      const contract = await ethers.getContractAt([sig], address);
      const funcName = sig.split(" ")[1].split("(")[0];
      const res = await contract[funcName](tokenId);
      console.log(`✅ ${funcName}:`, JSON.stringify(res, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } catch (e) {
      // If it doesn't take arguments (like name, symbol)
      try {
        const contract = await ethers.getContractAt([sig], address);
        const funcName = sig.split(" ")[1].split("(")[0];
        const res = await contract[funcName]();
        console.log(`✅ ${funcName}:`, res);
      } catch (err) {
        console.log(`❌ ${sig} failed: ${err.message}`);
      }
    }
  }
}

main().catch(console.error);
