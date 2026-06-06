require('dotenv').config();
const Web3             = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const contract         = require('@truffle/contract');
const RecDappArtifact  = require('./build/contracts/RecDapp.json');

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x113b2333e8De598240F627CE3592eA2D78e0d0aB';

const provider = new HDWalletProvider({
  mnemonic:      { phrase: process.env.MNEMONIC },
  providerOrUrl: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
});
const web3 = new Web3(provider);

const RecDapp = contract(RecDappArtifact);
RecDapp.setProvider(provider);

// EnergySource enum values — must match contract
const EnergySource = { Solar: 0, Wind: 1, Hydro: 2, Biomass: 3, Geothermal: 4, Other: 5 };

// ─── Helper ───────────────────────────────────────────────────────────────────

async function measure(label, fn) {
  const start = Date.now();
  console.log(`\n[${label}] starting...`);
  try {
    const receipt = await fn();
    const elapsed = ((Date.now() - start) / 1000).toFixed(2);

    if (receipt && receipt.receipt) {
      const gasUsed  = receipt.receipt.gasUsed;
      const gasPrice = BigInt(await web3.eth.getGasPrice());
      const feeWei   = BigInt(gasUsed) * gasPrice;
      console.log(`[${label}] done in ${elapsed}s | gas: ${gasUsed} | fee: ${web3.utils.fromWei(feeWei.toString(), 'ether')} ETH`);
    } else {
      console.log(`[${label}] done in ${elapsed}s (view call, no gas)`);
    }

    return receipt;
  } catch (err) {
    console.error(`[${label}] FAILED:`, err.message);
    throw err;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const accounts = await web3.eth.getAccounts();
  const [admin, producer, buyer] = accounts;

  console.log('Accounts:');
  console.log('  admin   :', admin);
  console.log('  producer:', producer);
  console.log('  buyer   :', buyer);

  const rec = await RecDapp.at(CONTRACT_ADDRESS);

  // 1. Issue a REC batch (1 500 kWh = 1.5 MWh solar, Greece-Attica)
  const issueTx = await measure('issueRec', () =>
    rec.issueRec(
      producer,
      EnergySource.Solar,
      1500,
      'GR-AT',
      'ipfs://QmExampleCID',
      { from: admin }
    )
  );

  // Extract token ID from the RecIssued event
  const tokenId = issueTx.logs.find(l => l.event === 'RecIssued').args.tokenId;
  console.log('  tokenId:', tokenId.toString());

  // 2. Verify the REC
  await measure('verifyRec', async () => {
    const [valid, meta] = await rec.verifyRec(tokenId);
    console.log('  valid:', valid);
    console.log('  source:', Object.keys(EnergySource)[meta.source]);
    console.log('  kwh:', meta.kwh.toString());
    console.log('  location:', meta.location);
    return { receipt: null };
  });

  // 3. Producer approves contract to hold tokens (required before listRec)
  await measure('setApprovalForAll', () =>
    rec.setApprovalForAll(rec.address, true, { from: producer })
  );

  // 4. Producer lists 1 000 kWh at 0.0001 ETH per kWh
  const pricePerKwh = web3.utils.toWei('0.0001', 'ether');
  const listTx = await measure('listRec', () =>
    rec.listRec(tokenId, 1000, pricePerKwh, { from: producer })
  );
  const listingId = listTx.logs.find(l => l.event === 'RecListed').args.listingId;
  console.log('  listingId:', listingId.toString());

  // 5. Buyer purchases 500 kWh
  const buyAmount  = 500;
  const totalCost  = BigInt(pricePerKwh) * BigInt(buyAmount);
  await measure('buyRec', () =>
    rec.buyRec(listingId, buyAmount, { from: buyer, value: totalCost.toString() })
  );

  // 6. Buyer retires 200 kWh (claims renewable energy usage)
  await measure('retireRec', () =>
    rec.retireRec(tokenId, 200, { from: buyer })
  );

  // 7. Check remaining kWh for this token
  const remaining = await rec.remainingKwh(tokenId);
  console.log('\n  Remaining un-retired kWh:', remaining.toString());
}

main()
  .then(() => { console.log('\nAll done.'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
