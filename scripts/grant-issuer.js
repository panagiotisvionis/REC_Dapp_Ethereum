/**
 * grant-issuer.js
 *
 * Grants ISSUER_ROLE to the address derived from ISSUER_PRIVATE_KEY.
 * The deployer (MNEMONIC account 0) must run this — it holds DEFAULT_ADMIN_ROLE.
 *
 * Usage:
 *   node scripts/grant-issuer.js
 */

require('dotenv').config();
const { ethers }  = require('ethers');
const artifact    = require('../build/contracts/RecDapp.json');

async function main() {
  // Admin = deployer (first account from mnemonic)
  const rpc = process.env.RPC_URL ||
    `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(rpc);

  if (!process.env.MNEMONIC || process.env.MNEMONIC.includes('twelve word')) {
    throw new Error('MNEMONIC is not set in .env');
  }
  if (!process.env.ISSUER_PRIVATE_KEY || process.env.ISSUER_PRIVATE_KEY.includes('your_issuer')) {
    throw new Error('ISSUER_PRIVATE_KEY is not set in .env');
  }
  if (!process.env.CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS.includes('0000')) {
    throw new Error('CONTRACT_ADDRESS is not set in .env — run post-deploy.js first');
  }

  const adminWallet  = ethers.Wallet.fromPhrase(process.env.MNEMONIC).connect(provider);
  const issuerWallet = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY);

  const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, adminWallet);

  const ISSUER_ROLE  = await contract.ISSUER_ROLE();
  const issuerAddr   = issuerWallet.address;
  const alreadyHas   = await contract.hasRole(ISSUER_ROLE, issuerAddr);

  console.log(`Admin    : ${adminWallet.address}`);
  console.log(`Issuer   : ${issuerAddr}`);
  console.log(`Contract : ${process.env.CONTRACT_ADDRESS}`);

  if (alreadyHas) {
    console.log('\n✓ Issuer already has ISSUER_ROLE — nothing to do.');
    return;
  }

  console.log('\nGranting ISSUER_ROLE…');
  const tx      = await contract.grantRole(ISSUER_ROLE, issuerAddr);
  const receipt = await tx.wait();
  console.log(`✓ ISSUER_ROLE granted (gas: ${receipt.gasUsed.toLocaleString()}, tx: ${tx.hash})`);
  console.log('\nReady to seed:  npm run seed');
}

main().catch(err => { console.error('\n✗', err.message); process.exit(1); });
