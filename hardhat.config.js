require('dotenv').config();
require('hardhat-gas-reporter');
require('@nomicfoundation/hardhat-ethers');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 30,          // gwei — conservative Sepolia estimate
    outputFile: 'evaluation/results/gas_report.txt',
    noColors: true,
    reportFormat: 'legacy',
  },
  networks: {
    hardhat: {
      chainId: 1337,
      hardfork: 'cancun',
      accounts: {
        mnemonic: process.env.MNEMONIC ||
          'test test test test test test test test test test test junk',
        count: 10,
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 1337,
    },
  },
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
    },
  },
};
