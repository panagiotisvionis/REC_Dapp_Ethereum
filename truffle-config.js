require('dotenv').config();

const HDWalletProvider = require('@truffle/hdwallet-provider');

const { MNEMONIC, ALCHEMY_API_KEY, POLYGONSCAN_API_KEY } = process.env;

function provider(rpcUrl) {
  return () => new HDWalletProvider({
    mnemonic:      { phrase: MNEMONIC },
    providerOrUrl: rpcUrl,
    pollingInterval: 8000,
  });
}

module.exports = {
  networks: {
    development: {
      host:       '127.0.0.1',
      port:       8545,
      network_id: '*',
    },

    sepolia: {
      provider:      provider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      network_id:    11155111,
      gas:           5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun:    true,
    },

    // Polygon Amoy (Mumbai replacement) — testnet, very low gas cost
    amoy: {
      provider:      provider(`https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      network_id:    80002,
      gas:           5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun:    true,
    },

    // Polygon mainnet — production
    polygon: {
      provider:      provider(`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`),
      network_id:    137,
      gas:           5500000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun:    false,
    },
  },

  plugins: ['truffle-plugin-verify'],

  api_keys: {
    polygonscan: POLYGONSCAN_API_KEY,
  },

  compilers: {
    solc: {
      version:  '0.8.28',
      settings: {
        optimizer: {
          enabled: true,
          runs:    200,
        },
        evmVersion: 'cancun',
      },
    },
  },
};
