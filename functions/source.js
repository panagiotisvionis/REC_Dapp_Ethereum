/**
 * RecChain — Chainlink Functions Source
 *
 * Runs inside the Chainlink Decentralized Oracle Network (DON).
 * Receives: args[0] = meterId  (e.g. "METER_GR_001")
 *           secrets.apiKey     (encrypted, set via Chainlink subscription)
 *           secrets.apiUrl     (base URL of your IoT API)
 *
 * Returns: abi-encoded uint256 representing verified kWh produced
 */

const meterId = args[0];

if (!meterId) throw Error("meterId argument is required");

// ── Fetch current meter reading ───────────────────────────────────────────
const reading = await Functions.makeHttpRequest({
  url:     `${secrets.apiUrl}/api/iot/meter/${encodeURIComponent(meterId)}`,
  headers: { "x-api-key": secrets.apiKey },
  timeout: 8000,
});

if (reading.error) throw Error(`IoT API request failed: ${reading.message}`);
if (reading.status !== 200) throw Error(`IoT API returned status ${reading.status}`);

const { kwhProduced, historicalAvg, stdDev, valid, reason } = reading.data;

// ── Validity gate ─────────────────────────────────────────────────────────
if (!valid) throw Error(`Meter reading rejected: ${reason || "unknown"}`);
if (typeof kwhProduced !== "number" || kwhProduced < 0) throw Error("Invalid kWh value");

// ── Bounds check ──────────────────────────────────────────────────────────
// A single reading cannot physically exceed 100 GWh
if (kwhProduced > 100_000_000) throw Error(`Value ${kwhProduced} kWh exceeds physical maximum`);

// ── Statistical anomaly detection (3-sigma rule) ──────────────────────────
// Uses historical data returned by the IoT API
if (historicalAvg !== null && stdDev !== null && stdDev > 0) {
  const zScore = Math.abs((kwhProduced - historicalAvg) / stdDev);
  if (zScore > 3) {
    throw Error(
      `Anomaly detected for ${meterId}: z-score = ${zScore.toFixed(2)} ` +
      `(reading=${kwhProduced}, avg=${historicalAvg}, σ=${stdDev})`
    );
  }
}

// ── Return verified kWh encoded as uint256 ────────────────────────────────
return Functions.encodeUint256(Math.floor(kwhProduced));
