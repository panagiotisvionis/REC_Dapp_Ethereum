const HDWalletProvider = require('@truffle/hdwallet-provider');
const alchemyApiKey = "Jfh2pAl1Ersa9GhEAYri5-MWwXY0Oob_";
const mnemonic = "winner sting switch business brave blind spring taxi parent dove grief novel";

module.exports = {
  networks: {
    sepolia: {
      provider: () => new HDWalletProvider({
        mnemonic: {
          phrase: mnemonic
        },
        providerOrUrl: `https://eth-sepolia.g.alchemy.com/v2/Jfh2pAl1Ersa9GhEAYri5-MWwXY0Oob_`,
        pollingInterval: 8000 // Διάστημα αιτήσεων polling σε milliseconds (8 seconds)
      }),
      network_id: 11155111,       // Sepolia's id
      gas: 5500000,        // Gas limit
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
  },
  compilers: {
    solc: {
      version: "0.8.0",    // Fetch exact version from solc-bin (default: truffle's version)
    }
  }
};
