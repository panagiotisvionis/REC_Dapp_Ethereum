const { Router }                                       = require('express');
const { getContract, serializeListing, serializeMeta } = require('../lib/contract');

const router = Router();

// GET /api/listings — returns all active listings enriched with REC metadata
router.get('/', async (req, res) => {
  try {
    const rec   = getContract();
    const count = await rec.listingCount();
    const results = [];

    for (let i = 0; i < Number(count); i++) {
      const listing = await rec.listings(i);
      if (!listing.active) continue;

      const [valid, meta] = await rec.verifyRec(listing.tokenId);
      results.push({
        ...serializeListing(i, listing),
        valid,
        metadata: serializeMeta(meta),
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/:listingId
router.get('/:listingId', async (req, res) => {
  try {
    const rec     = getContract();
    const id      = BigInt(req.params.listingId);
    const listing = await rec.listings(id);

    if (!listing.active) {
      return res.status(404).json({ error: 'Listing not found or inactive' });
    }

    const [valid, meta] = await rec.verifyRec(listing.tokenId);
    res.json({ ...serializeListing(id, listing), valid, metadata: serializeMeta(meta) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/listings/portfolio/:address — all token IDs held by an address
router.get('/portfolio/:address', async (req, res) => {
  try {
    const rec     = getContract();
    const address = req.params.address;

    // Discover all issued token IDs via RecIssued events
    const filter = rec.filters.RecIssued();
    const events = await rec.queryFilter(filter, 0, 'latest');
    const tokenIds = [...new Set(events.map(e => e.args.tokenId))];

    const holdings = [];
    for (const tokenId of tokenIds) {
      const balance = await rec.balanceOf(address, tokenId);
      const retired = await rec.retiredBy(address, tokenId);

      if (balance > 0n || retired > 0n) {
        const [valid, meta] = await rec.verifyRec(tokenId);
        holdings.push({
          tokenId:  tokenId.toString(),
          balance:  balance.toString(),
          retired:  retired.toString(),
          valid,
          metadata: serializeMeta(meta),
        });
      }
    }

    res.json(holdings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
