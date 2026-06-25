const { ethers } = require("hardhat");

async function main() {
  // ============== KNOWN POOL KEY ==============
  const POOL_KEY = {
    currency0: "0x0000000000000000000000000000000000000000", // native OKB
    currency1: "0x422fe165b2da990d18c6dca944b11dcd61519671", // GRUSH
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x026198469007ad6a9ffa9e161b7a2d6dce542088"
  };

  const UNIVERSAL_ROUTER = "0x8b844f885672f333bc0042cb669255f93a4c1e6b"; // v2.1.1
  const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";

  // ============== ACTION CONSTANTS ==============
  const SWAP_EXACT_IN_SINGLE = 0x06;
  const SETTLE_ALL = 0x0c;
  const TAKE_ALL = 0x0f;
  const V4_SWAP = 0x10;

  // ============== BUILD CALLDATA ==============
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const amountIn = ethers.parseEther("0.01"); // 0.01 OKB test
  const minAmountOut = 0n; // 0 for test/simulation

  // 1. Encode ExactInputSingleParams
  // struct ExactInputSingleParams {
  //   PoolKey poolKey;
  //   bool zeroForOne;
  //   uint128 amountIn;
  //   uint128 amountOutMinimum;
  //   bytes hookData;
  // }
  const swapParams = abiCoder.encode(
    ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [[
      [POOL_KEY.currency0, POOL_KEY.currency1, POOL_KEY.fee, POOL_KEY.tickSpacing, POOL_KEY.hooks],
      true, // zeroForOne: swapping currency0 (OKB) for currency1 (GRUSH)
      amountIn,
      minAmountOut,
      "0x" // empty hookData
    ]]
  );

  // 2. Encode SETTLE_ALL params: (currency, maxAmount)
  const settleParams = abiCoder.encode(
    ["address", "uint128"],
    [POOL_KEY.currency0, amountIn]
  );

  // 3. Encode TAKE_ALL params: (currency, minAmount)
  const takeParams = abiCoder.encode(
    ["address", "uint128"],
    [POOL_KEY.currency1, minAmountOut]
  );

  // 4. Encode actions bytes
  const actions = ethers.concat([
    new Uint8Array([SWAP_EXACT_IN_SINGLE]),
    new Uint8Array([SETTLE_ALL]),
    new Uint8Array([TAKE_ALL])
  ]);

  // 5. Encode the V4_SWAP input: abi.encode(actions, params)
  const v4SwapInput = abiCoder.encode(
    ["bytes", "bytes[]"],
    [actions, [swapParams, settleParams, takeParams]]
  );

  // 6. Build the commands and inputs for execute()
  const commands = new Uint8Array([V4_SWAP]);
  const inputs = [v4SwapInput];
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // 7. Encode the full execute() call
  const routerIface = new ethers.Interface([
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
  ]);

  const calldata = routerIface.encodeFunctionData("execute", [
    commands,
    inputs,
    deadline
  ]);

  console.log("=== V4 Swap Calldata ===");
  console.log(`Router: ${UNIVERSAL_ROUTER}`);
  console.log(`Calldata length: ${calldata.length} chars`);
  console.log(`Calldata: ${calldata.slice(0, 50)}...`);

  // 8. Simulate the call via eth_call
  console.log("\nSimulating swap via eth_call...");
  try {
    const result = await ethers.provider.call({
      to: UNIVERSAL_ROUTER,
      data: calldata,
      value: amountIn,
      from: "0x956A587c0e0A879c179939be9907E82aB8a7CB36" // graduation tx sender
    });
    console.log("✅ Simulation succeeded! Result:", result);
  } catch (e) {
    console.log("❌ Simulation failed:", e.message);
    
    // Try with a simpler approach - maybe the router version is different
    // Let's also try the other Universal Router address
    console.log("\nTrying older Universal Router...");
    const UNIVERSAL_ROUTER_OLD = "0xda00ae15d3a71466517129255255db7c0c0956d3";
    try {
      const result2 = await ethers.provider.call({
        to: UNIVERSAL_ROUTER_OLD,
        data: calldata,
        value: amountIn,
        from: "0x956A587c0e0A879c179939be9907E82aB8a7CB36"
      });
      console.log("✅ Old router simulation succeeded! Result:", result2);
    } catch (e2) {
      console.log("❌ Old router simulation also failed:", e2.message);
    }
  }
}

main().catch(console.error);
