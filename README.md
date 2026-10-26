
# Renewable Energy Certificates (RECs) dApp on Ethereum

## Journal revision (26 October 2026)

The current research branch adds workflow metadata authentication, report replay
protection, registry-level consumption of non-overlapping meter intervals, and
commitments to screening evidence and policy. Expired certificates cannot be
purchased or transferred between peers; cancellation can return expired escrow.

The public PV experiment compares a common capacity guard, rolling z-score and
historically calibrated EWMA on three installations. Received-history results
are mixed; EWMA is not uniformly better. This is controlled corruption of public
PV output, not verified fraud detection or physical-meter deployment.

See [evaluation_journal/README.md](evaluation_journal/README.md) for data,
protocol, replication results and reproducible commands, and
[paper/README.md](paper/README.md) for the revised manuscript.

The current revision passes 72 local Hardhat cases (57 behavioural, 15 gas),
ten rule tests and eight HTTP fixture checks. The workflow type checks and
compiles to WASM. It has **not** been registered with or run on a live CRE DON.
Simulation claims in the archived release concern the earlier payload format.
The legacy Functions integration is retained as historical code; its service
was withdrawn in June 2026. No new chain deployment is performed here.

> ## Security
>
> A `.env` file containing live credentials, including a wallet mnemonic and an
> issuer private key, was committed to this repository's history. Deleting the
> file does not undo the exposure. Those credentials must be rotated and the
> corresponding on-chain role revoked. Use `.env.example` as the template; never
> commit `.env`.


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

