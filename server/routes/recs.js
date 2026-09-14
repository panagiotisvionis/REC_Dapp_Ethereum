const { Router }                                    = require('express');
const { getContract, getSignerContract, serializeMeta } = require('../lib/contract');
const { generatePassport }                          = require('../lib/passport');
const { resolveProvenance }                         = require('../lib/provenance');
const { ethers }                                    = require('ethers');

const router = Router();

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// GET /api/recs/:tokenId
router.get('/:tokenId', async (req, res) => {
  try {
    const rec   = getContract();
    const id    = BigInt(req.params.tokenId);
    const [valid, meta] = await rec.verifyRec(id);
    const remaining     = await rec.remainingKwh(id);

    if (meta.producer === ZERO_ADDR) {
      return res.status(404).json({ error: 'Token not found' });
    }

    res.json({ tokenId: id.toString(), valid, remaining: remaining.toString(), metadata: serializeMeta(meta) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/recs/:tokenId/passport  — returns PDF Carbon Passport
// ?download=1  → force file download  (default: inline in browser)
router.get('/:tokenId/passport', async (req, res) => {
  try {
    const rec   = getContract();
    const id    = BigInt(req.params.tokenId);
    const [, meta]  = await rec.verifyRec(id);
    const remaining = await rec.remainingKwh(id);

    if (meta.producer === ZERO_ADDR) {
      return res.status(404).json({ error: 'Token not found' });
    }

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    // Provenance is decided from the issuer field and, on a workflow registry,
    // from issuedByWorkflow(); the evaluated RecDapp has no such view, so a
    // failed call is treated as false.
    const metadata = serializeMeta(meta);
    let issuedByWorkflow = false;
    try {
      const view = new ethers.Contract(await rec.getAddress(),
        ['function issuedByWorkflow(uint256) view returns (bool)'], rec.runner);
      issuedByWorkflow = await view.issuedByWorkflow(id);
    } catch (_) { issuedByWorkflow = false; }
    const provenance = resolveProvenance(metadata,
      { registryAddress: await rec.getAddress(), issuedByWorkflow });

    const pdf = await generatePassport(req.params.tokenId, metadata, remaining, appBaseUrl, provenance);

    const disposition = req.query.download === '1'
      ? `attachment; filename="REC-${req.params.tokenId}-passport.pdf"`
      : 'inline';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recs/issue — requires ISSUER_PRIVATE_KEY in .env
router.post('/issue', async (req, res) => {
  try {
    const { producer, source, kwh, location, dataHash } = req.body;

    if (!producer || source === undefined || !kwh || !location || !dataHash) {
      return res.status(400).json({ error: 'Missing required fields: producer, source, kwh, location, dataHash' });
    }

    const rec     = getSignerContract();
    const tx      = await rec.issueRec(producer, Number(source), BigInt(kwh), location, dataHash);
    const receipt = await tx.wait();

    const event = receipt.logs
      .map(log => { try { return rec.interface.parseLog(log); } catch { return null; } })
      .find(e => e && e.name === 'RecIssued');

    res.status(201).json({
      txHash:  receipt.hash,
      tokenId: event ? event.args.tokenId.toString() : null,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
