const { ethers } = require("hardhat");

async function main() {
  const txHash = "0x5b13c480dcd4f19deb523004f03997708191dc7e29db9b8be616586e49ebe767";
  const receipt = await ethers.provider.getTransactionReceipt(txHash);

  console.log(`Decoding ${receipt.logs.length} logs for tx ${txHash}...`);

  const abis = [
    // ERC20
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
    
    // Uniswap V4 PoolManager
    "event Initialize(bytes32 indexed poolId, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks)",
    "event ModifyLiquidity(bytes32 indexed poolId, address indexed sender, int24 tickLower, int24 tickUpper, int256 liquidityDelta, bytes32 salt)",
    "event Swap(bytes32 indexed poolId, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, bytes32 salt)",
    
    // Uniswap V3 Pool
    "event Initialize(uint160 sqrtPriceX96, int24 tick)",
    "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
    "event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
    "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
    
    // Uniswap V3 Factory
    "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
    
    // Uniswap V2
    "event PairCreated(address indexed token0, address indexed token1, address pair, uint256)",
    "event Mint(address indexed sender, uint256 amount0, uint256 amount1)",
    "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)"
  ];

  const iface = new ethers.Interface(abis);

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\nLog ${i} (Address: ${log.address}):`);
    try {
      const parsed = iface.parseLog(log);
      console.log(`  Decoded Event Name: ${parsed.name}`);
      console.log(`  Args:`, JSON.stringify(parsed.args, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    } catch (e) {
      console.log(`  Could not decode using standard ABIs.`);
      console.log(`  Topics:`, log.topics);
      console.log(`  Data:`, log.data);
    }
  }
}

main().catch(console.error);
