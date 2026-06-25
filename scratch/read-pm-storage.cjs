const { ethers } = require("hardhat");

async function main() {
  const pmAddress = "0x360e68faccca8ca495c1b759fd9eee466db9fb32";
  const poolId = "0xd639d7f0dc532caec7e31703281519f9e59a027a93ab71df3257ef9454fbef4f";

  // Let's create interface for extsload
  const pm = await ethers.getContractAt([
    "function extsload(bytes32 slot) external view returns (bytes32)"
  ], pmAddress);

  // Let's try different mapping slots (Uniswap V4 versions use slot 6 or 10 or similar for pools)
  // Let's brute-force the mapping slot index from 0 to 20!
  console.log("Reading PoolManager storage via extsload...");

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  for (let slotIndex = 0; slotIndex <= 20; slotIndex++) {
    // Mapping slot formula: keccak256(poolId + slotIndex)
    // In Solidity: keccak256(abi.encode(poolId, slotIndex))
    const encoded = abiCoder.encode(["bytes32", "uint256"], [poolId, BigInt(slotIndex)]);
    const slot = ethers.keccak256(encoded);
    
    try {
      const data = await pm.extsload(slot);
      if (data !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`🎉 Found non-zero slot at mapping slotIndex ${slotIndex}!`);
        console.log(`  Slot: ${slot}`);
        console.log(`  Data: ${data}`);
        
        // Let's decode Slot0:
        // Slot0 format:
        // - sqrtPriceX96 (uint160) - 20 bytes
        // - tick (int24) - 3 bytes
        // - protocolFee (uint24) - 3 bytes (or 1 byte protocolFee, 3 bytes lpFee, etc. depending on version)
        // - lpFee (uint24) - 3 bytes
        // Let's slice the hex data (which is 32 bytes = 64 characters + '0x')
        // Usually, variables are packed from right to left (least significant to most significant bytes)
        // or left to right.
        // Let's print the sliced values!
        const dataHex = data.slice(2); // remove 0x
        console.log(`  Raw hex data: ${dataHex}`);
      }
    } catch (e) {
      console.log(`SlotIndex ${slotIndex} failed:`, e.message);
    }
  }
}

main().catch(console.error);
