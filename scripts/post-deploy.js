/**
 * post-deploy.js
 *
 * Run after `truffle migrate --network sepolia --reset` to wire up the new
 * contract address in all the right places.
 *
 * Usage:
 *   node scripts/post-deploy.js 0xYourNewContractAddress
 */

const fs   = require('fs');
const path = require('path');

const address = process.argv[2];
if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error('Usage: node scripts/post-deploy.js <contract_address>');
  console.error('Example: node scripts/post-deploy.js 0xAbCd...1234');
  process.exit(1);
}

const ROOT        = path.join(__dirname, '..');
const ENV_FILE    = path.join(ROOT, '.env');
const CLIENT_ENV  = path.join(ROOT, 'client', '.env.local');

// ── Update .env ─────────────────────────────────────────────────────────────
let envContent = fs.readFileSync(ENV_FILE, 'utf8');

if (envContent.includes('CONTRACT_ADDRESS=')) {
  envContent = envContent.replace(
    /^CONTRACT_ADDRESS=.*$/m,
    `CONTRACT_ADDRESS="${address}"`
  );
} else {
  envContent += `\nCONTRACT_ADDRESS="${address}"\n`;
}

fs.writeFileSync(ENV_FILE, envContent);
console.log(`✓ .env               → CONTRACT_ADDRESS="${address}"`);

// ── Create / update client/.env.local ───────────────────────────────────────
const clientEnvContent = `VITE_CONTRACT_ADDRESS=${address}\n`;
fs.writeFileSync(CLIENT_ENV, clientEnvContent);
console.log(`✓ client/.env.local  → VITE_CONTRACT_ADDRESS=${address}`);

console.log('\nNext steps:');
console.log('  1. Grant ISSUER_ROLE to your issuer account:');
console.log('     node scripts/grant-issuer.js');
console.log('  2. Seed demo data:');
console.log('     npm run seed');
console.log('  3. Start services:');
console.log('     npm run server  (terminal 1)');
console.log('     npm run client:dev  (terminal 2)');
