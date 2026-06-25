const { ethers } = require("hardhat");

async function main() {
  const hookAddress = "0x85C22cc30415f5B1B8B7C508677f7656a2ae5Aa0";
  const implAddress = "0x5A8b7CFb5000a1fc9bddA0F092eB42d4Cae8f3e5";
  const errorSelector = "9e41bdd7";

  const proxyCode = await ethers.provider.getCode(hookAddress);
  const implCode = await ethers.provider.getCode(implAddress);

  console.log(`Searching for '${errorSelector}' in bytecode...`);
  console.log(`Proxy contains errorSelector: ${proxyCode.includes(errorSelector)}`);
  console.log(`Implementation contains errorSelector: ${implCode.includes(errorSelector)}`);

  // Let's also check if there are other occurrences of 9e41bd...
  // In EVM, custom error revert uses `revert(offset, size)` where the data at `offset` starts with the 4-byte selector.
  // The push4 opcode for 0x9e41bdd7 would be `639e41bdd7`.
  const pushOpcode = "639e41bdd7";
  console.log(`Proxy contains pushOpcode (639e41bdd7): ${proxyCode.includes(pushOpcode)}`);
  console.log(`Implementation contains pushOpcode (639e41bdd7): ${implCode.includes(pushOpcode)}`);
}

main().catch(console.error);
