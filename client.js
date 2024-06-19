require('dotenv').config();
const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const contract = require('@truffle/contract');
const RecDappArtifact = require('./build/contracts/RecDapp.json');

const alchemyUrl = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
const provider = new HDWalletProvider({
  mnemonic: {
    phrase: process.env.MNEMONIC
  },
  providerOrUrl: alchemyUrl
});
const web3 = new Web3(provider);

const RecDapp = contract(RecDappArtifact);
RecDapp.setProvider(provider);

async function measureTransactionTime(transactionFunction, description) {
  const startTime = Date.now(); // Ξεκινήστε το χρονόμετρο
  
  console.log(`${description} started at ${new Date(startTime).toISOString()}`);

  const receipt = await transactionFunction();
  console.log(`${description} Transaction Receipt:`, receipt);

  const endTime = Date.now(); // Σταματήστε το χρονόμετρο
  const timeDifference = (endTime - startTime) / 1000; // από milliseconds σε δευτερόλεπτα

  if (receipt && receipt.receipt && receipt.receipt.gasUsed) {
    const gasUsed = receipt.receipt.gasUsed;
    const gasPrice = await web3.eth.getGasPrice();
    const fee = gasUsed * gasPrice;
    const feeInEther = web3.utils.fromWei(fee.toString(), 'ether');
    const computeUnitsConsumed = gasUsed;

    console.log(`${description} completed at ${new Date(endTime).toISOString()} in`, timeDifference, 'seconds');
    console.log(`${description} cost:`, fee, 'wei (', feeInEther, 'ETH)');
    console.log(`${description} compute units consumed:`, computeUnitsConsumed);
  } else {
    console.log(`${description} completed at ${new Date(endTime).toISOString()} in`, timeDifference, 'seconds');
    console.log('No gas used information available for this transaction.');
  }
}

async function main() {
  const accounts = await web3.eth.getAccounts();
  console.log('Accounts:', accounts);

  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found. Please ensure your Ethereum client is configured correctly.');
  }

  accounts.forEach(account => {
    if (!web3.utils.isAddress(account)) {
      throw new Error(`Invalid address: ${account}`);
    }
  });

  const recDapp = await RecDapp.at('0x113b2333e8De598240F627CE3592eA2D78e0d0aB');

  await measureTransactionTime(async () => {
    const receipt = await recDapp.issueRec(accounts[1], 'example_data', { from: accounts[0] });
    console.log('REC issued to:', accounts[1]);
    return receipt;
  }, 'REC issued');

  await measureTransactionTime(async () => {
    const receipt = await recDapp.verifyRec(accounts[1], 'example_data', { from: accounts[0] });
    return { receipt: receipt }; // Επιστρέφουμε ένα αντικείμενο με την απόδειξη
  }, 'REC verified');

  await measureTransactionTime(async () => {
    const receipt = await recDapp.requestRec(accounts[1], 1000, { from: accounts[0] });
    return receipt;
  }, 'REC request submitted');

  await measureTransactionTime(async () => {
    const receipt = await recDapp.issueAndSellRec(accounts[1], 'example_data', web3.utils.toWei('0.01', 'ether'), {
      from: accounts[0],
      value: web3.utils.toWei('0.01', 'ether')
    });
    console.log('REC issued and sold');
    return receipt;
  }, 'REC issued and sold');
}

main().then(() => console.log('Done')).catch(err => console.error(err));
