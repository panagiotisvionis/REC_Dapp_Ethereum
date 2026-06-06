const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');

const SOURCES = ['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Other'];

const CO2_PER_MWH   = 0.35;   // tCO₂/MWh (EU average grid emission factor)
const KM_PER_TCO2   = 4000;   // km by average EU passenger car per tCO₂
const TREES_PER_TCO2 = 48;    // trees absorbing 1 tCO₂/year (EU forest avg)

const GREEN  = '#16a34a';
const DARK   = '#1f2937';
const GRAY   = '#6b7280';
const LGRAY  = '#9ca3af';
const BORDER = '#e5e7eb';
const BG     = '#f9fafb';
const WHITE  = '#ffffff';

async function generatePassport(tokenId, metadata, remainingKwh, appBaseUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const kwh    = Number(metadata.kwh);
      const mwh    = kwh / 1000;
      const source = SOURCES[metadata.source] || 'Other';
      const co2    = mwh * CO2_PER_MWH;
      const km     = Math.round(co2 * KM_PER_TCO2);
      const trees  = Math.round(co2 * TREES_PER_TCO2);

      const now         = Date.now() / 1000;
      const isValid     = !metadata.fullyRetired && now <= Number(metadata.expiresAt);
      const isOracle    = (metadata.dataHash || '').startsWith('oracle://');

      const fmt = (ts) => new Date(Number(ts) * 1000)
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const issuedDate = fmt(metadata.issuedAt);
      const expiryDate = fmt(metadata.expiresAt);

      const verifyUrl = `${appBaseUrl}/verify/${tokenId}`;
      const qrBuf     = await QRCode.toBuffer(verifyUrl, { width: 120, margin: 1 });

      const doc    = new PDFDocument({ size: 'A4', margin: 0, info: {
        Title:   `REC #${tokenId} — Carbon Passport`,
        Author:  'RecChain Platform',
        Subject: 'Renewable Energy Certificate',
      }});
      const chunks = [];
      doc.on('data',  c => chunks.push(c));
      doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W  = doc.page.width;   // 595.28 pt
      const H  = doc.page.height;  // 841.89 pt
      const M  = 50;
      const CW = W - 2 * M;

      // ── Header bar ────────────────────────────────────────────────────────
      doc.rect(0, 0, W, 88).fill(GREEN);

      doc.font('Helvetica-Bold').fontSize(22).fillColor(WHITE)
         .text('RecChain', M, 22);
      doc.font('Helvetica').fontSize(9.5).fillColor('rgba(255,255,255,0.75)')
         .text('Renewable Energy Certificate Platform', M, 49);

      // Status badge
      const badgeBg   = isValid ? '#bbf7d0' : '#fecaca';
      const badgeTxt  = isValid ? '#166534' : '#991b1b';
      const badgeLabel = isValid ? '✓  VALID' : (metadata.fullyRetired ? '✗  RETIRED' : '✗  EXPIRED');
      doc.roundedRect(W - M - 102, 28, 102, 28, 5).fill(badgeBg);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(badgeTxt)
         .text(badgeLabel, W - M - 102, 38, { width: 102, align: 'center' });

      let y = 108;

      // ── Title ─────────────────────────────────────────────────────────────
      doc.font('Helvetica-Bold').fontSize(17).fillColor(DARK)
         .text('RENEWABLE ENERGY CERTIFICATE', M, y, { width: CW, align: 'center' });
      y += 24;
      doc.font('Helvetica').fontSize(11).fillColor(GRAY)
         .text('Carbon Passport', M, y, { width: CW, align: 'center' });
      y += 22;
      _divider(doc, M, y, CW);
      y += 14;

      // ── Certificate ID + QR ───────────────────────────────────────────────
      doc.font('Helvetica').fontSize(8).fillColor(LGRAY)
         .text('CERTIFICATE ID', M, y);
      y += 12;
      doc.font('Helvetica-Bold').fontSize(26).fillColor(GREEN)
         .text(`#${tokenId}`, M, y);
      y += 34;

      // QR code — top-right of content area
      doc.image(qrBuf, W - M - 112, 118, { width: 112 });
      doc.font('Helvetica').fontSize(7.5).fillColor(LGRAY)
         .text('Scan to verify online', W - M - 112, 237, { width: 112, align: 'center' });

      // ── Identity rows ─────────────────────────────────────────────────────
      const colW = CW - 130;
      _row(doc, M, y, colW, 'Energy Source', source);          y += 24;
      _row(doc, M, y, colW, 'Location',      metadata.location); y += 24;
      _row(doc, M, y, colW, 'Producer',      _addr(metadata.producer)); y += 24;
      _row(doc, M, y, colW, 'Issuer',        isOracle ? 'RecChain Oracle (Chainlink)' : _addr(metadata.issuer)); y += 32;

      // ── Production Details ────────────────────────────────────────────────
      y = _sectionHeader(doc, M, y, CW, 'PRODUCTION DETAILS');

      const h1 = CW / 2 - 6;
      _row(doc, M,       y, h1, 'Energy Produced', `${kwh.toLocaleString()} kWh  (${mwh.toFixed(2)} MWh)`);
      _row(doc, M + h1 + 12, y, h1, 'Issue Date',   issuedDate);
      y += 24;
      _row(doc, M,       y, h1, 'Valid Until',    expiryDate);
      _row(doc, M + h1 + 12, y, h1, 'Remaining',  `${Number(remainingKwh).toLocaleString()} kWh`);
      y += 32;

      // ── Environmental Impact ──────────────────────────────────────────────
      y = _sectionHeader(doc, M, y, CW, 'ENVIRONMENTAL IMPACT');

      const cW = Math.floor(CW / 3) - 6;
      const cGap = 9;
      _impactCard(doc, M,              y, cW, `~${co2.toFixed(3)}`,   'tCO₂ Avoided',     GREEN);
      _impactCard(doc, M + cW + cGap,  y, cW, `~${km.toLocaleString()}`, 'km by car avoided', '#0284c7');
      _impactCard(doc, M + (cW + cGap) * 2, y, cW, `~${trees}`, 'Trees (1 yr)',      '#15803d');
      y += 82;

      // ── Blockchain Verification ───────────────────────────────────────────
      y = _sectionHeader(doc, M, y, CW, 'BLOCKCHAIN VERIFICATION');

      _row(doc, M, y, CW, 'Verification Method',
           isOracle ? '✓  Oracle-verified via Chainlink Functions (off-chain computation)' : '✓  Manually issued by certified body');
      y += 24;
      _row(doc, M, y, CW, 'Data Reference', metadata.dataHash);
      y += 24;
      _row(doc, M, y, CW, 'Verify Online',  verifyUrl);
      y += 32;

      // ── Footer ────────────────────────────────────────────────────────────
      const fY = H - 62;
      doc.rect(0, fY - 12, W, H - fY + 12).fill(BG);
      _divider(doc, M, fY - 12, CW);

      doc.font('Helvetica').fontSize(7.5).fillColor(LGRAY)
         .text(
           'This certificate is immutably recorded on the Ethereum blockchain and cannot be altered or double-counted. ' +
           'Retirement of this certificate constitutes a claim of the associated renewable energy production ' +
           'for ESG and GHG Protocol reporting purposes (Scope 2 market-based accounting).',
           M, fY - 2, { width: CW, align: 'center', lineGap: 2 }
         );
      doc.text(
        `Generated ${new Date().toISOString().slice(0, 10)} · RecChain Platform · ${appBaseUrl}`,
        M, fY + 26, { width: CW, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _divider(doc, x, y, width) {
  doc.moveTo(x, y).lineTo(x + width, y).strokeColor(BORDER).lineWidth(0.5).stroke();
}

function _sectionHeader(doc, x, y, width, title) {
  _divider(doc, x, y, width);
  y += 9;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN)
     .text(title, x, y, { characterSpacing: 0.8 });
  return y + 18;
}

function _row(doc, x, y, width, label, value) {
  doc.font('Helvetica').fontSize(7.5).fillColor(LGRAY)
     .text(label.toUpperCase(), x, y, { width });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(value || '—', x, y + 11, { width });
}

function _impactCard(doc, x, y, width, value, label, color) {
  doc.rect(x, y, width, 68).fill(BG).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.font('Helvetica-Bold').fontSize(15).fillColor(color)
     .text(value, x, y + 12, { width, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor(GRAY)
     .text(label, x, y + 36, { width, align: 'center', lineGap: 2 });
}

function _addr(addr) {
  if (!addr || addr.length <= 14) return addr || '—';
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

module.exports = { generatePassport };
