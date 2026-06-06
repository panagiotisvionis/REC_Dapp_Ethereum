/**
 * RecChain — Demo Data Seed Script
 *
 * Creates realistic demo data on Sepolia:
 *   • 14 REC batches across 5 Greek renewable energy sites
 *   • Mix of Solar / Wind / Hydro / Geothermal
 *   • Active marketplace listings
 *   • Retired certificates (ESG claims with CO2 offset data)
 *   • Oracle-verified and manually-issued RECs
 *
 * Prerequisites:
 *   1. Contract deployed and CONTRACT_ADDRESS set in .env
 *   2. ISSUER_PRIVATE_KEY account must have ISSUER_ROLE on the contract
 *   3. ISSUER_PRIVATE_KEY account must have Sepolia ETH for gas
 *      (get from https://sepoliafaucet.com)
 *
 * Usage:
 *   node scripts/seed.js            ← executes all transactions
 *   node scripts/seed.js --dry-run  ← shows plan without sending tx
 */

require('dotenv').config();
const { ethers } = require('ethers');
const artifact   = require('../build/contracts/RecDapp.json');

const DRY_RUN = process.argv.includes('--dry-run');

// Defer wallet/contract creation — dry-run doesn't need a valid private key
let PROVIDER, SIGNER, CONTRACT;

function initWeb3() {
  if (PROVIDER) return; // already initialized
  PROVIDER = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
  if (!process.env.ISSUER_PRIVATE_KEY || process.env.ISSUER_PRIVATE_KEY.includes('your_issuer')) {
    throw new Error('ISSUER_PRIVATE_KEY is not set in .env');
  }
  SIGNER   = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY, PROVIDER);
  CONTRACT = new ethers.Contract(process.env.CONTRACT_ADDRESS, artifact.abi, SIGNER);
}

// ── Energy sources (must match contract enum) ─────────────────────────────────
const SRC = { Solar: 0, Wind: 1, Hydro: 2, Biomass: 3, Geothermal: 4, Other: 5 };

// ── Demo dataset ──────────────────────────────────────────────────────────────
//
// story: three large producers + two smaller ones
// each with multiple production batches over 6 months
// some retired (corporate ESG claims), some on sale
//
const DEMO_RECS = [

  // ── Kalamata Solar Farm (GR-AT) ────────────────────────────────────────────
  {
    site:     'Kalamata Solar Farm',
    source:   SRC.Solar,
    kwh:      15_000,
    location: 'GR-AT',
    dataHash: 'ipfs://QmKalamata1Jan2025SolarProductionReport',
    retire:   10_000,   // ESG claim: 10 MWh = 3.5 tCO₂ avoided
  },
  {
    site:     'Kalamata Solar Farm',
    source:   SRC.Solar,
    kwh:      18_000,
    location: 'GR-AT',
    dataHash: 'oracle://METER_GR_001',   // oracle-verified
    listAmount:  12_000,
    pricePerKwh: ethers.parseEther('0.00010'),
  },
  {
    site:     'Kalamata Solar Farm',
    source:   SRC.Solar,
    kwh:      9_000,
    location: 'GR-AT',
    dataHash: 'ipfs://QmKalamata3Mar2025SolarProductionReport',
    // held — not listed, not retired
  },

  // ── Epirus Hydro Station (GR-EP) ───────────────────────────────────────────
  {
    site:     'Epirus Hydro Station',
    source:   SRC.Hydro,
    kwh:      22_000,
    location: 'GR-EP',
    dataHash: 'ipfs://QmEpirus1Jan2025HydroProductionReport',
    listAmount:  8_000,
    pricePerKwh: ethers.parseEther('0.00012'),
  },
  {
    site:     'Epirus Hydro Station',
    source:   SRC.Hydro,
    kwh:      20_000,
    location: 'GR-EP',
    dataHash: 'oracle://METER_GR_003',
    retire:   16_000,   // 16 MWh → 5.6 tCO₂
  },
  {
    site:     'Epirus Hydro Station',
    source:   SRC.Hydro,
    kwh:      28_000,
    location: 'GR-EP',
    dataHash: 'ipfs://QmEpirus3Apr2025HydroProductionReport',
    // held
  },

  // ── Makedonia Wind Park (GR-MA) ────────────────────────────────────────────
  {
    site:     'Makedonia Wind Park',
    source:   SRC.Wind,
    kwh:      35_000,
    location: 'GR-MA',
    dataHash: 'ipfs://QmMakedonia1Jan2025WindProductionReport',
    listAmount:  15_000,
    pricePerKwh: ethers.parseEther('0.00008'),
  },
  {
    site:     'Makedonia Wind Park',
    source:   SRC.Wind,
    kwh:      30_000,
    location: 'GR-MA',
    dataHash: 'oracle://METER_GR_002',
    retire:   25_000,   // 25 MWh → 8.75 tCO₂ — large corporate claim
  },
  {
    site:     'Makedonia Wind Park',
    source:   SRC.Wind,
    kwh:      40_000,
    location: 'GR-MA',
    dataHash: 'ipfs://QmMakedonia3Mar2025WindProductionReport',
    listAmount:  20_000,
    pricePerKwh: ethers.parseEther('0.00007'),
  },
  {
    site:     'Makedonia Wind Park',
    source:   SRC.Wind,
    kwh:      25_000,
    location: 'GR-MA',
    dataHash: 'oracle://METER_GR_002',
    // held
  },

  // ── Crete Solar Array (GR-CR) ──────────────────────────────────────────────
  {
    site:     'Crete Solar Array',
    source:   SRC.Solar,
    kwh:      20_000,
    location: 'GR-CR',
    dataHash: 'oracle://METER_GR_004',
    listAmount:  8_000,
    pricePerKwh: ethers.parseEther('0.00011'),
  },
  {
    site:     'Crete Solar Array',
    source:   SRC.Solar,
    kwh:      14_000,
    location: 'GR-CR',
    dataHash: 'ipfs://QmCrete2Feb2025SolarProductionReport',
    retire:   10_000,   // 10 MWh → 3.5 tCO₂
  },

  // ── Aegean Wind Cluster (GR-AG) ────────────────────────────────────────────
  {
    site:     'Aegean Wind Cluster',
    source:   SRC.Wind,
    kwh:      42_000,
    location: 'GR-AG',
    dataHash: 'oracle://METER_GR_005',
    listAmount:  18_000,
    pricePerKwh: ethers.parseEther('0.00009'),
  },
  {
    site:     'Aegean Wind Cluster',
    source:   SRC.Geothermal,
    kwh:      12_000,
    location: 'GR-AG',
    dataHash: 'ipfs://QmAegean2Feb2025GeothermalProductionReport',
    // held — adds variety to the portfolio
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n)  { return Number(n).toLocaleString(); }
function mwh(k)  { return (k / 1000).toFixed(1); }
function co2(k)  { return (k / 1000 * 0.35).toFixed(2); }

async function send(label, txFn) {
  if (DRY_RUN) { console.log(`  [dry-run] ${label}`); return { dryRun: true }; }
  const tx      = await txFn();
  const receipt = await tx.wait();
  console.log(`  ✓ ${label} (gas: ${receipt.gasUsed.toLocaleString()}, tx: ${tx.hash.slice(0, 12)}…)`);
  return receipt;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n━━━ RecChain Demo Seed ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (DRY_RUN) console.log('  MODE: dry-run — no transactions will be sent\n');

  if (!DRY_RUN) initWeb3();

  // Preflight
  const signer  = DRY_RUN ? '0x0000000000000000000000000000000000000000' : await SIGNER.getAddress();
  const balance = DRY_RUN ? BigInt(0) : await PROVIDER.getBalance(signer);
  console.log(`  Signer  : ${DRY_RUN ? '(dry-run — no signer)' : signer}`);
  console.log(`  Balance : ${DRY_RUN ? 'N/A' : ethers.formatEther(balance) + ' ETH'}`);
  console.log(`  Contract: ${process.env.CONTRACT_ADDRESS || '(not set)'}\n`);

  if (!DRY_RUN && balance < ethers.parseEther('0.05')) {
    console.warn('  ⚠  Balance < 0.05 ETH — may not have enough gas for all transactions.');
    console.warn('     Get Sepolia ETH from https://sepoliafaucet.com\n');
  }

  // Check issuer role
  let hasRole = true;
  if (!DRY_RUN) {
    const ISSUER_ROLE = await CONTRACT.ISSUER_ROLE();
    hasRole = await CONTRACT.hasRole(ISSUER_ROLE, signer);
    if (!hasRole) {
      console.error('  ✗ Signer does not have ISSUER_ROLE. Aborting.');
      process.exit(1);
    }
  }
  console.log(`  ISSUER_ROLE: ${DRY_RUN ? '(skipped in dry-run)' : '✓ confirmed'}\n`);

  // Approve contract once for all listRec calls
  const needsApproval = DEMO_RECS.some(r => r.listAmount);
  if (needsApproval && !DRY_RUN) {
    const alreadyApproved = await CONTRACT.isApprovedForAll(signer, process.env.CONTRACT_ADDRESS);
    if (!alreadyApproved) {
      console.log('Approving contract for token transfers…');
      await send('setApprovalForAll', () =>
        CONTRACT.setApprovalForAll(process.env.CONTRACT_ADDRESS, true)
      );
    } else {
      console.log('  ✓ Contract already approved for transfers\n');
    }
  }

  // Summary counters
  let totalKwh = 0, totalRetired = 0, totalListed = 0, listings = 0;
  const tokenIds = [];

  // Issue, list, retire
  for (let i = 0; i < DEMO_RECS.length; i++) {
    const rec = DEMO_RECS[i];
    console.log(`\n[${i + 1}/${DEMO_RECS.length}] ${rec.site} — ${rec.kwh.toLocaleString()} kWh (${mwh(rec.kwh)} MWh)`);

    // Issue
    let tokenId = null;
    const issueTx = await send(
      `issueRec(source=${rec.source}, kwh=${fmt(rec.kwh)}, loc=${rec.location})`,
      () => CONTRACT.issueRec(signer, rec.source, BigInt(rec.kwh), rec.location, rec.dataHash)
    );

    if (!DRY_RUN && issueTx.logs) {
      const event = issueTx.logs
        .map(l => { try { return CONTRACT.interface.parseLog(l); } catch { return null; } })
        .find(e => e?.name === 'RecIssued');
      if (event) tokenId = event.args.tokenId;
    } else {
      tokenId = BigInt(i + 1); // placeholder for dry-run
    }

    tokenIds.push(tokenId);
    totalKwh += rec.kwh;

    // List
    if (rec.listAmount && tokenId !== null) {
      await send(
        `listRec(tokenId=${tokenId}, amount=${fmt(rec.listAmount)}, price=${ethers.formatEther(rec.pricePerKwh)} ETH/kWh)`,
        () => CONTRACT.listRec(tokenId, BigInt(rec.listAmount), rec.pricePerKwh)
      );
      totalListed += rec.listAmount;
      listings++;
    }

    // Retire
    if (rec.retire && tokenId !== null) {
      await send(
        `retireRec(tokenId=${tokenId}, amount=${fmt(rec.retire)}) → ~${co2(rec.retire)} tCO₂`,
        () => CONTRACT.retireRec(tokenId, BigInt(rec.retire))
      );
      totalRetired += rec.retire;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━ Seed Complete ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  RECs issued    : ${DEMO_RECS.length} batches`);
  console.log(`  Total energy   : ${fmt(totalKwh)} kWh  (${mwh(totalKwh)} MWh)`);
  console.log(`  Active listings: ${listings} listings  (${fmt(totalListed)} kWh available)`);
  console.log(`  Retired        : ${fmt(totalRetired)} kWh  → ~${co2(totalRetired)} tCO₂ offset`);
  console.log(`  Trees equiv    : ~${Math.round(totalRetired / 1000 * 0.35 * 48)} trees`);
  console.log('\n  Token IDs created:', tokenIds.map(t => t?.toString()).join(', '));
  console.log('\n  ✓ Platform is ready for demo.\n');
}

main().catch(err => { console.error('\n✗ Seed failed:', err.message); process.exit(1); });
