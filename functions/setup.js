/**
 * Chainlink Functions — one-time setup helper
 *
 * Reads the JS source from source.js, encodes it, and calls setFunctionsSource()
 * + setDonConfig() on the deployed RecDapp contract.
 *
 * Usage:
 *   node functions/setup.js
 *
 * Prerequisites:
 *   1. Deploy RecDapp (truffle migrate --network sepolia)
 *   2. Create a Chainlink Functions subscription at https://functions.chain.link
 *   3. Fund subscription with LINK (min 2 LINK recommended)
 *   4. Add your CONTRACT_ADDRESS as a consumer in the subscription UI
 *   5. Fill .env: CONTRACT_ADDRESS, ISSUER_PRIVATE_KEY, ALCHEMY_API_KEY,
 *                 CHAINLINK_SUBSCRIPTION_ID
 */

require('dotenv').config();
const { ethers } = require('ethers');
const fs         = require('fs');
const path       = require('path');
const artifact   = require('../build/contracts/RecDapp.json');

// Sepolia Chainlink Functions constants
const SEPOLIA_DON_ID = ethers.encodeBytes32String('fun-ethereum-sepolia-1');
const CALLBACK_GAS   = 300_000;

async function main() {
  const provider   = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
  const signer     = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY, provider);
  const contract   = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, signer);

  const subscriptionId = Number(process.env.CHAINLINK_SUBSCRIPTION_ID);
  if (!subscriptionId) throw new Error('CHAINLINK_SUBSCRIPTION_ID not set in .env');

  // 1. Upload the JS source to the contract
  const source = fs.readFileSync(path.join(__dirname, 'source.js'), 'utf8');
  console.log(`Setting Functions source (${source.length} chars)…`);
  const tx1 = await contract.setFunctionsSource(source);
  await tx1.wait();
  console.log('  ✓ source set, tx:', tx1.hash);

  // 2. Configure DON ID, subscription, and gas limit
  console.log(`Setting DON config (subscription=${subscriptionId})…`);
  const tx2 = await contract.setDonConfig(SEPOLIA_DON_ID, subscriptionId, CALLBACK_GAS);
  await tx2.wait();
  console.log('  ✓ DON config set, tx:', tx2.hash);

  console.log('\nSetup complete. Oracle auto-issuance is ready.');
  console.log('Call requestAutoIssuance() from an ISSUER_ROLE address to test.');
}

main().catch(err => { console.error(err); process.exit(1); });
