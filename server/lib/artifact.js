/**
 * Locate the RecDapp ABI. `npx hardhat compile` writes it under artifacts/;
 * older Truffle builds wrote build/contracts/. Neither directory is committed,
 * so one of the two builds must be run before the server or scripts start.
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CANDIDATES = [
  path.join(ROOT, 'artifacts', 'contracts', 'RecDapp.sol', 'RecDapp.json'),
  path.join(ROOT, 'build', 'contracts', 'RecDapp.json'),
];

function loadRecDappArtifact() {
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('RecDapp ABI not found; run `npx hardhat compile` first');
  }
  return require(found);
}

module.exports = { loadRecDappArtifact };
