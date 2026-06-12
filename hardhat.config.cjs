require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

let PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
if (!PRIVATE_KEY.startsWith("0x")) {
  if (PRIVATE_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(PRIVATE_KEY)) {
    PRIVATE_KEY = "0x" + PRIVATE_KEY;
  } else {
    PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
} else if (PRIVATE_KEY.length !== 66 || !/^[0-9a-fA-F]+$/.test(PRIVATE_KEY.slice(2))) {
  PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";
}

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // X Layer Testnet
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC || "https://testrpc.xlayer.tech",
      accounts: [PRIVATE_KEY],
    },
    // X Layer Mainnet
    xlayerMainnet: {
      url: process.env.XLAYER_MAINNET_RPC || "https://rpc.xlayer.tech",
      accounts: [PRIVATE_KEY],
    },
  },
};
