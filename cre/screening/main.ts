/**
 * RecChain — CRE workflow (migration target for the sunset Chainlink Functions
 * implementation in ../functions/source.js).
 *
 * STATUS: implemented and unit-tested; NOT YET REGISTERED OR EXECUTED against a
 * CRE deployment. Do not describe it as runtime-validated until
 * `cre workflow simulate` has been run successfully.
 *
 * WHAT CHANGES RELATIVE TO functions/source.js
 * --------------------------------------------
 *   1. FAIL-CLOSED. A reading whose history cannot be established is rejected,
 *      never issued. The legacy script skipped the test instead.
 *   2. THE BASELINE IS COMPUTED HERE. The workflow retrieves the trailing
 *      same-hour readings and derives the reference level itself, so the
 *      screening decision no longer depends on moments the endpoint supplies
 *      about itself. Screening happens in the workflow, off-chain; the
 *      contract acts on the signed result.
 *   3. THE STATISTIC CHANGED. The legacy path used a flat 30-sample mean
 *      (rolling z-score). On measured generation data an exponentially
 *      weighted residual score is better at every anomaly prevalence tested, so
 *      this workflow uses EWMA with lambda* = 0.5, selected on a chronological
 *      calibration split. See evaluation_v2/calibration.py.
 *   4. REJECTIONS ARE VISIBLE. The consumer contract emits an event per meter;
 *      the legacy callback returned silently below the issuance floor.
 *
 * WHAT THIS DOES NOT ESTABLISH
 * ----------------------------
 * The current reading and the history it is judged against still come from the
 * same reporting interface. An adversary controlling that interface can serve a
 * fabricated history against which a fabricated reading is consistent. This is
 * a data-quality control, not authentication, and not proof that any
 * electricity was generated.
 */

import {
  CronCapability,
  EVMClient,
  HTTPClient,
  handler,
  consensusIdenticalAggregation,
  prepareReportRequest,
  getNetwork,
  json,
  ok,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, type Hex } from "viem";

// ── Configuration, supplied at workflow deployment ───────────────────────────
export type Config = {
  schedule: string;          // cron expression, e.g. "0 0 * * * *"
  meterApiBaseUrl: string;   // IoT meter REST endpoint
  meterIds: string[];        // installations this workflow is responsible for
  consumerAddress: string;   // RecDappCRE receiving the signed report
  chainSelector: string;     // target EVM chain, e.g. "ethereum-testnet-sepolia"
  gasLimit: string;          // gas limit for the consumer write
  threshold: number;         // see the calibration note in screen()
  lambda: number;            // EWMA smoothing; 0.5 from the calibration split
  windowDays: number;        // trailing same-hour history, 30
  minKwh: number;            // issuance floor, 1000 kWh = 1 MWh
};

export type Reading = { timestampUtc: string; kwh: number };
type Fetched = { current?: Reading; history: Reading[] };

const REJECT = {
  NO_READING: "no current reading",
  NO_HISTORY: "insufficient history",
  NOT_FINITE: "non-finite or negative reading",
  BOUND: "exceeds physical bound",
  ANOMALY: "score above threshold",
  BELOW_FLOOR: "below 1 MWh issuance floor",
} as const;

const PHYSICAL_MAX_KWH = 100_000_000;   // 100 GWh in one hourly interval

// ── Statistics, computed in-workflow ─────────────────────────────────────────
/**
 * Exponentially weighted location, with an unweighted dispersion estimate over
 * the same window. Weighting the dispersion as well would couple location and
 * scale to the same recent observations and destabilise the score on short
 * windows; the manuscript states this explicitly.
 */
function ewmaStats(xs: number[], lambda: number): { mu: number; sd: number } {
  const n = xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const w = lambda * Math.pow(1 - lambda, n - 1 - i);
    num += w * xs[i];
    den += w;
  }
  const mu = num / den;
  const flat = xs.reduce((a, b) => a + b, 0) / n;
  const varr = xs.reduce((a, b) => a + (b - flat) ** 2, 0) / (n - 1);
  return { mu, sd: Math.sqrt(varr) };
}

/**
 * Screen one meter. Every path that cannot establish a baseline rejects.
 *
 * CALIBRATION NOTE: cfg.threshold must NOT be derived from `history`. Thirty
 * observations resolve an empirical quantile no finer than ~1/30, so an alert
 * target of 1% or below is not estimable from the detection window. Supply it
 * in the workflow configuration, estimated offline from a pooled corpus of
 * standardised residuals for this meter, and re-estimate on a schedule.
 */
function screen(
  current: Reading | undefined,
  history: Reading[],
  cfg: Config,
): { kwh: number } | { reject: string } {
  if (!current || typeof current.kwh !== "number") return { reject: REJECT.NO_READING };
  const x = current.kwh;

  if (!Number.isFinite(x) || x < 0) return { reject: REJECT.NOT_FINITE };
  if (x > PHYSICAL_MAX_KWH) return { reject: REJECT.BOUND };

  const hour = new Date(current.timestampUtc).getUTCHours();
  const sameHour = history
    .filter((r) => Number.isFinite(r.kwh) && new Date(r.timestampUtc).getUTCHours() === hour)
    .slice(-cfg.windowDays)
    .map((r) => r.kwh);

  if (sameHour.length < cfg.windowDays) return { reject: REJECT.NO_HISTORY };

  const { mu, sd } = ewmaStats(sameHour, cfg.lambda);
  const scale = Math.max(sd, 1);
  if (Math.abs((x - mu) / scale) > cfg.threshold) return { reject: REJECT.ANOMALY };

  if (x < cfg.minKwh) return { reject: REJECT.BELOW_FLOOR };
  return { kwh: Math.floor(x) };
}

// ── Workflow body ────────────────────────────────────────────────────────────
/**
 * Each node fetches independently and the results must agree before the
 * workflow proceeds, which is what distinguishes this from a single-server
 * call. Identical aggregation is correct here: a meter reading is a fact the
 * nodes should agree on exactly, not a value to be averaged.
 */
export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const httpClient = new HTTPClient();

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: cfg.chainSelector,
    isTestnet: true,
  });
  if (!network) throw new Error(`unknown chain selector: ${cfg.chainSelector}`);
  const evmClient = new EVMClient(network.chainSelector.selector);

  const fetchMeter = httpClient.sendRequest(
    runtime,
    (sendRequester, meterId: string) => {
      const id = encodeURIComponent(meterId);
      const cur = sendRequester
        .sendRequest({ url: `${cfg.meterApiBaseUrl}/api/iot/meter/${id}`, method: "GET" })
        .result();
      const hist = sendRequester
        .sendRequest({
          url: `${cfg.meterApiBaseUrl}/api/iot/meter/${id}/history?days=${cfg.windowDays}`,
          method: "GET",
        })
        .result();

      // Fail-closed: an unavailable endpoint yields no history, which screen()
      // rejects rather than waving through.
      if (!ok(cur) || !ok(hist)) return { history: [] } as Fetched;

      return {
        current: json(cur) as Reading,
        history: json(hist) as Reading[],
      } as Fetched;
    },
    consensusIdenticalAggregation<Fetched>(),
  );

  const meterIds: string[] = [];
  const volumes: bigint[] = [];

  for (const meterId of cfg.meterIds) {
    // A transport failure throws before the ok() guard inside the consensus
    // function can run, so it is caught here. Containing it per meter is
    // deliberate: an unreachable endpoint must block that meter's issuance,
    // not every other meter's. Either way no certificate is minted from data
    // that could not be retrieved.
    let fetched: Fetched;
    try {
      fetched = fetchMeter(meterId).result();
    } catch (err) {
      runtime.log(`${meterId}: rejected (endpoint unreachable)`);
      continue;
    }

    const outcome = screen(fetched.current, fetched.history, cfg);
    if ("reject" in outcome) {
      runtime.log(`${meterId}: rejected (${outcome.reject})`);
      continue;
    }
    runtime.log(`${meterId}: admitted (${outcome.kwh} kWh)`);
    meterIds.push(meterId);
    volumes.push(BigInt(outcome.kwh));
  }

  if (meterIds.length === 0) {
    runtime.log("no meter passed screening; no report submitted");
    return "no issuance";
  }

  // abi.encode(string[] meterIds, uint256[] kwh), decoded by RecDappCRE.onReport
  const payload: Hex = encodeAbiParameters(
    [{ type: "string[]" }, { type: "uint256[]" }],
    [meterIds, volumes],
  );

  const report = runtime.report(prepareReportRequest(payload)).result();

  evmClient
    .writeReport(runtime, {
      receiver: cfg.consumerAddress,
      report,
      gasConfig: { gasLimit: cfg.gasLimit },
    })
    .result();

  runtime.log(`submitted ${meterIds.length} verified issuance(s)`);
  return `submitted ${meterIds.length} issuance(s)`;
};

export const initWorkflow = (config: Config) => {
  const cron = new CronCapability();
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
