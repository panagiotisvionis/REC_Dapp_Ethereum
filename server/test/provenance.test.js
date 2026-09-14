/**
 * Provenance classification used by the Carbon Passport.
 * Run with: node --test server/test/
 */
const test   = require('node:test');
const assert = require('node:assert/strict');
const { resolveProvenance } = require('../lib/provenance');
const { generatePassport }  = require('../lib/passport');

const REGISTRY = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const ISSUER   = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const CONSUMER = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

const meta = (issuer, dataHash) => ({
  issuer, producer: ISSUER, source: 0, kwh: '35000', location: 'GR-AT',
  issuedAt: '1735689600', expiresAt: '4102444800', fullyRetired: false, dataHash,
});

test('Functions issuance: issuer equals the registry address', () => {
  const p = resolveProvenance(meta(REGISTRY, 'oracle://METER_GR_001'), { registryAddress: REGISTRY });
  assert.equal(p.path, 'functions'); assert.equal(p.oracleMediated, true);
});

test('address comparison is case-insensitive', () => {
  const p = resolveProvenance(meta(REGISTRY.toLowerCase(), 'oracle://M'), { registryAddress: REGISTRY.toUpperCase().replace('0X', '0x') });
  assert.equal(p.oracleMediated, true);
});

test('CRE issuance: recorded by the registry through issuedByWorkflow', () => {
  const p = resolveProvenance(meta(CONSUMER, 'cre://METER_GR_001'), { registryAddress: REGISTRY, issuedByWorkflow: true });
  assert.equal(p.path, 'workflow'); assert.equal(p.oracleMediated, true);
});

test('manual issuance with a spoofed oracle:// reference is not oracle-mediated', () => {
  const p = resolveProvenance(meta(ISSUER, 'oracle://METER_GR_001'), { registryAddress: REGISTRY });
  assert.equal(p.path, 'manual'); assert.equal(p.oracleMediated, false);
  assert.equal(p.referenceClaimsOracle, true);
});

test('manual issuance with a spoofed cre:// reference is not oracle-mediated', () => {
  const p = resolveProvenance(meta(ISSUER, 'cre://METER_GR_001'), { registryAddress: REGISTRY, issuedByWorkflow: false });
  assert.equal(p.oracleMediated, false);
});

test('ordinary manual issuance', () => {
  const p = resolveProvenance(meta(ISSUER, 'ipfs://QmReport'), { registryAddress: REGISTRY });
  assert.equal(p.path, 'manual'); assert.equal(p.referenceClaimsOracle, false);
});

test('without on-chain context nothing is classified as oracle-mediated', () => {
  const p = resolveProvenance(meta(REGISTRY, 'oracle://METER_GR_001'));
  assert.equal(p.oracleMediated, false);
});

test('passport renders for a spoofed manual certificate without resolving it as oracle', async () => {
  const m = meta(ISSUER, 'oracle://METER_GR_001');
  const prov = resolveProvenance(m, { registryAddress: REGISTRY });
  const pdf = await generatePassport('7', m, 35000n, 'http://localhost:5173', prov);
  assert.ok(Buffer.isBuffer(pdf) && pdf.subarray(0, 5).toString() === '%PDF-');
});

test('passport renders for Functions and workflow provenance', async () => {
  for (const [issuer, ref, wf] of [[REGISTRY, 'oracle://M', false], [CONSUMER, 'cre://M', true]]) {
    const m = meta(issuer, ref);
    const pdf = await generatePassport('1', m, 1000n, 'http://localhost:5173',
      resolveProvenance(m, { registryAddress: REGISTRY, issuedByWorkflow: wf }));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  }
});
