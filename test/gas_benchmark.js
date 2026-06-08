/**
 * gas_benchmark.js — RecChain smart contract gas cost table
 *
 * Covers all state-changing functions in RecDapp.sol.
 * requestAutoIssuance() is excluded: requires live Chainlink subscription.
 * fulfillRequest() is internal (oracle callback) — not directly callable.
 *
 * Run:
 *   npx hardhat test test/gas_benchmark.js
 *
 * Output appended to:
 *   evaluation/results/gas_report.txt   (via hardhat-gas-reporter)
 *   evaluation/results/gas_table.json   (structured, for paper table)
 */

const { expect }   = require('chai');
const { ethers }   = require('hardhat');
const fs           = require('fs');
const path         = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const GWEI_GAS_PRICE  = 30n;            // gwei — conservative Sepolia estimate
const ETH_USD         = 3200n;          // USD/ETH at time of evaluation
const WEI_PER_GWEI    = 1_000_000_000n;
const WEI_PER_ETH     = 10n ** 18n;

const EnergySource = { Solar: 0, Wind: 1, Hydro: 2, Biomass: 3 };
const LOCATION     = "GR-AT";
const DATA_HASH    = "bafkreih7z2v6q";
const ONE_MWH      = 1000n;   // kWh units — minimum issuance
const FIVE_MWH     = 5000n;

function usdCost(gasUsed) {
  const gasBig  = BigInt(gasUsed);
  const weiCost = gasBig * GWEI_GAS_PRICE * WEI_PER_GWEI;
  const usd     = Number(weiCost * ETH_USD) / Number(WEI_PER_ETH);
  return usd.toFixed(4);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("RecChain Gas Benchmark", function () {
  // generous timeout for compilation
  this.timeout(120_000);

  let contract, deployer, issuer, producer, buyer, seller;
  const results = [];

  function record(fn, gasUsed, note = '') {
    results.push({ fn, gasUsed: Number(gasUsed), note });
    console.log(`    ${fn.padEnd(32)} ${String(gasUsed).padStart(8)} gas   ~$${usdCost(gasUsed)} ${note}`);
  }

  before(async function () {
    [deployer, issuer, producer, buyer, seller] = await ethers.getSigners();

    // FunctionsClient constructor only stores the router address — any non-zero
    // address works for local tests where oracle functions are not exercised.
    const mockRouter = ethers.Wallet.createRandom().address;

    const Factory = await ethers.getContractFactory("RecDapp");
    contract = await Factory.deploy(
      "https://recchain.io/api/token/{id}.json",
      mockRouter,
    );
    await contract.waitForDeployment();

    // Grant ISSUER_ROLE to issuer account
    const ISSUER_ROLE = await contract.ISSUER_ROLE();
    await contract.connect(deployer).grantRole(ISSUER_ROLE, issuer.address);
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  it("deploy — contract deployment", async function () {
    const mockRouter = ethers.Wallet.createRandom().address;
    const Factory = await ethers.getContractFactory("RecDapp");
    const tx = await Factory.deploy(
      "https://recchain.io/api/token/{id}.json",
      mockRouter,
    );
    const receipt = await tx.deploymentTransaction().wait();
    record("deploy", receipt.gasUsed, "(one-time)");
    expect(Number(receipt.gasUsed)).to.be.gt(0);
  });

  // ── Admin / role management ────────────────────────────────────────────────

  it("grantRole — grant ISSUER_ROLE", async function () {
    const ISSUER_ROLE = await contract.ISSUER_ROLE();
    const newIssuer   = ethers.Wallet.createRandom().address;
    const tx      = await contract.connect(deployer).grantRole(ISSUER_ROLE, newIssuer);
    const receipt = await tx.wait();
    record("grantRole", receipt.gasUsed);
  });

  it("setFunctionsSource — store Chainlink JS source", async function () {
    const src = `const meter=args[0]; const r=await Functions.makeHttpRequest({url:'https://api.recchain.io/meter/'+meter}); return Functions.encodeUint256(r.data.kwh);`;
    const tx      = await contract.connect(deployer).setFunctionsSource(src);
    const receipt = await tx.wait();
    record("setFunctionsSource", receipt.gasUsed, `(${src.length}b source)`);
  });

  it("setDonConfig — configure Chainlink DON", async function () {
    const donId = ethers.encodeBytes32String("fun-ethereum-sepolia-1");
    const tx      = await contract.connect(deployer).setDonConfig(donId, 1234, 300_000);
    const receipt = await tx.wait();
    record("setDonConfig", receipt.gasUsed);
  });

  it("setURI — update metadata base URI", async function () {
    const tx      = await contract.connect(deployer).setURI("https://v2.recchain.io/api/token/{id}.json");
    const receipt = await tx.wait();
    record("setURI", receipt.gasUsed);
  });

  // ── Issuance ───────────────────────────────────────────────────────────────

  it("issueRec — issue 1 MWh (1 000 kWh)", async function () {
    const tx = await contract.connect(issuer).issueRec(
      producer.address, EnergySource.Solar, ONE_MWH, LOCATION, DATA_HASH
    );
    const receipt = await tx.wait();
    record("issueRec", receipt.gasUsed, "(1 MWh, Solar)");
  });

  it("issueRec — issue 5 MWh (5 000 kWh)", async function () {
    const tx = await contract.connect(issuer).issueRec(
      producer.address, EnergySource.Wind, FIVE_MWH, LOCATION, DATA_HASH
    );
    const receipt = await tx.wait();
    record("issueRec (5 MWh)", receipt.gasUsed, "(5 MWh, Wind)");
  });

  it("issueRec — issue 100 MWh", async function () {
    const tx = await contract.connect(issuer).issueRec(
      producer.address, EnergySource.Hydro, 100_000n, "GR-MA", "bafkxyz"
    );
    const receipt = await tx.wait();
    record("issueRec (100 MWh)", receipt.gasUsed, "(100 MWh, Hydro)");
    // note: gas should be identical to 1 MWh — stored as uint256
  });

  // ── Transfer (ERC1155) ─────────────────────────────────────────────────────

  it("safeTransferFrom — peer-to-peer transfer", async function () {
    // Use token #1 (1 MWh Solar issued above)
    const tx = await contract.connect(producer).safeTransferFrom(
      producer.address, seller.address, 1n, 500n, "0x"
    );
    const receipt = await tx.wait();
    record("safeTransferFrom", receipt.gasUsed, "(500 kWh, P2P)");
  });

  // ── Marketplace ────────────────────────────────────────────────────────────

  it("listRec — create marketplace listing", async function () {
    // seller has 500 kWh of token #1 from the transfer above
    const pricePerKwh = ethers.parseEther("0.0001"); // 0.0001 ETH/kWh
    const tx = await contract.connect(seller).listRec(1n, 500n, pricePerKwh);
    const receipt = await tx.wait();
    record("listRec", receipt.gasUsed, "(500 kWh listed)");
  });

  it("buyRec — purchase from listing (partial)", async function () {
    // listing #0: 500 kWh at 0.0001 ETH/kWh
    const pricePerKwh = ethers.parseEther("0.0001");
    const amountToBuy = 100n;
    const total       = pricePerKwh * amountToBuy;
    const tx = await contract.connect(buyer).buyRec(0n, amountToBuy, { value: total });
    const receipt = await tx.wait();
    record("buyRec", receipt.gasUsed, "(100 kWh partial)");
  });

  it("buyRec — purchase remaining (clears listing)", async function () {
    const pricePerKwh = ethers.parseEther("0.0001");
    const amountToBuy = 400n; // clears the listing
    const total       = pricePerKwh * amountToBuy;
    const tx = await contract.connect(buyer).buyRec(0n, amountToBuy, { value: total });
    const receipt = await tx.wait();
    record("buyRec (clears listing)", receipt.gasUsed, "(400 kWh, full clear)");
  });

  it("cancelListing — cancel active listing", async function () {
    // Issue a new REC and list it so we can cancel
    const tx1 = await contract.connect(issuer).issueRec(
      seller.address, EnergySource.Solar, ONE_MWH, LOCATION, DATA_HASH
    );
    await tx1.wait();
    const tokenId = await contract.listingCount(); // next token is 4

    const tx2 = await contract.connect(seller).listRec(
      4n, ONE_MWH, ethers.parseEther("0.0002")
    );
    await tx2.wait();

    const listId  = (await contract.listingCount()) - 1n;
    const tx3     = await contract.connect(seller).cancelListing(listId);
    const receipt = await tx3.wait();
    record("cancelListing", receipt.gasUsed);
  });

  // ── Retirement ─────────────────────────────────────────────────────────────

  it("retireRec — partial retirement (500 kWh)", async function () {
    // buyer has 500 kWh of token #1 from purchases
    const tx = await contract.connect(buyer).retireRec(1n, 500n);
    const receipt = await tx.wait();
    record("retireRec (partial)", receipt.gasUsed, "(500 kWh)");
  });

  it("retireRec — full retirement (sets fullyRetired flag)", async function () {
    // Issue a fresh 1 MWh to producer
    const tx1 = await contract.connect(issuer).issueRec(
      producer.address, EnergySource.Biomass, ONE_MWH, LOCATION, "bafk999"
    );
    await tx1.wait();

    // Retire all 1000 kWh
    const tokenId = 5n;
    const tx2     = await contract.connect(producer).retireRec(tokenId, ONE_MWH);
    const receipt = await tx2.wait();
    record("retireRec (full batch)", receipt.gasUsed, "(1000 kWh, sets fullyRetired)");

    const meta = await contract.recMetadata(tokenId);
    expect(meta.fullyRetired).to.equal(true);
  });

  // ── Summary table ──────────────────────────────────────────────────────────

  after(function () {
    const RESULTS_DIR = path.join(__dirname, '..', 'evaluation', 'results');
    fs.mkdirSync(RESULTS_DIR, { recursive: true });

    // Deduplicate: keep the last entry for each function name
    const seen = {};
    for (const r of results) {
      seen[r.fn] = r;
    }
    const deduped = Object.values(seen);

    const table = {
      timestamp:     new Date().toISOString(),
      network:       "Hardhat (local, cancun fork)",
      solidity:      "0.8.28, optimizer 200 runs",
      gas_price_gwei: Number(GWEI_GAS_PRICE),
      eth_usd:        Number(ETH_USD),
      entries: deduped.map(r => ({
        function:  r.fn,
        gas_used:  r.gas_used || r.gasUsed,
        cost_usd:  parseFloat(usdCost(r.gas_used || r.gasUsed)),
        note:      r.note,
      })),
    };

    const jsonPath = path.join(RESULTS_DIR, 'gas_table.json');
    fs.writeFileSync(jsonPath, JSON.stringify(table, null, 2));

    // Human-readable ASCII table
    let txt = 'RecChain Smart Contract — Gas Cost Table\n';
    txt += `Network: Hardhat (local, EVM cancun) | Solidity 0.8.28, optimizer 200 runs\n`;
    txt += `Gas price: ${GWEI_GAS_PRICE} gwei | ETH/USD: $${ETH_USD}\n\n`;
    txt += `${'Function'.padEnd(32)} ${'Gas Used'.padStart(10)} ${'Cost (USD)'.padStart(12)}   Note\n`;
    txt += '-'.repeat(80) + '\n';
    for (const r of table.entries) {
      const gas = r.gas_used;
      txt += `${r.function.padEnd(32)} ${String(gas).padStart(10)} ${('$' + r.cost_usd.toFixed(4)).padStart(12)}   ${r.note}\n`;
    }
    txt += '-'.repeat(80) + '\n';
    txt += `\nNote: costs are estimates at ${GWEI_GAS_PRICE} gwei. Actual Sepolia/mainnet costs vary with network congestion.\n`;

    const txtPath = path.join(RESULTS_DIR, 'gas_table.txt');
    fs.writeFileSync(txtPath, txt);

    console.log('\n' + txt);
    console.log(`\n  Saved → evaluation/results/gas_table.json`);
    console.log(`  Saved → evaluation/results/gas_table.txt`);
  });
});
