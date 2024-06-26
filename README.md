
# Renewable Energy Certificates (RECs) dApp on Ethereum

This repository contains a decentralized application (dApp) for managing Renewable Energy Certificates (RECs) on the Ethereum blockchain. The application allows users to issue, verify, request, and sell RECs using smart contracts. Below you'll find an overview of the smart contract, setup instructions, and usage examples.

## Usage

### Functions
- **Issue REC**: Issues a new REC with the provided data.
- **Verify REC**: Verifies if the provided data matches the stored REC data.
- **Request REC**: Submits a request for a REC with the specified kWh.
- **Issue and Sell REC**: Issues and sells a REC for a specified price.

## Setup Instructions

### Prerequisites
- **Node.js**: Ensure you have Node.js installed on your system. 
- **Truffle**: Install Truffle globally using npm:
  ```bash
  npm install -g truffle
  ```

- **HDWalletProvider**: Install the HDWalletProvider package:
  ```bash
  npm install @truffle/hdwallet-provider
  ```

- **dotenv**: Install dotenv to manage environment variables:
  ```bash
  npm install dotenv
  ```

- **Alchemy API Key**: Sign up at Alchemy and get your API key.

- **Ethereum Wallet**: Set up MetaMask or another Ethereum wallet to interact with the smart contracts.

### Configuration
- **Clone the Repository**:
  ```bash
  git clone https://github.com/panagiotisvionis/REC_Dapp_Ethereum.git
  cd REC_Dapp_Ethereum
  ```

- **Install Dependencies**:
  ```bash
  npm install
  ```

- **Set Up Environment Variables**:
  - Create a `.env` file in the root directory of the project.
  - Add your mnemonic phrase and Alchemy API key to the `.env` file:
    ```bash
    MNEMONIC="your mnemonic phrase here"
    ALCHEMY_API_KEY="your alchemy api key here"
    ```

### Deployment
- **Compile the Smart Contracts**:
  ```bash
  truffle compile
  ```

- **Migrate (Deploy) the Smart Contracts to the Sepolia Network**:
  ```bash
  truffle migrate --network sepolia
  ```

### Running the Application
- **Interact with the Smart Contract**:
  - You can use the provided script (`client.js`) to interact with the deployed smart contract.
  - Ensure you have the correct contract address and ABI in your script.
  - Execute the script using Node.js:
    ```bash
    node client.js
    ```

### Additional Configuration for Web3
- **Ensure Web3 is correctly configured to connect to the Sepolia network using Alchemy**:
  ```javascript
  const alchemyUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  const provider = new HDWalletProvider({
    mnemonic: {
      phrase: process.env.MNEMONIC
    },
    providerOrUrl: alchemyUrl
  });
  const web3 = new Web3(provider);
  ```

## Contributing
Feel free to submit issues, fork the repository, and send pull requests.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

