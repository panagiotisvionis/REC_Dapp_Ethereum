/** CRE screening workflow. The V2 receiver binds a pinned workflow identity,
 * unique non-overlapping production intervals and evidence/policy commitments.
 * Statistical consistency does not authenticate the reporting endpoint.
 * This revision has not been registered with a live CRE DON.
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

import { screen, type Reading, type ScreenConfig } from "./rule";
import { keccak256, toBytes } from "viem";
export type Config = ScreenConfig & {
  schedule: string; meterApiBaseUrl: string; meterIds: string[];
  consumerAddress: string; chainSelector: string; gasLimit: string;
  meterPolicies?: Record<string, {threshold:number;maxKwh:number}>;
};
type Fetched = { current?: Reading; history: Reading[] };

// ── Workflow body ────────────────────────────────────────────────────────────
/**
 * Each node fetches independently and the results must agree before the
 * workflow proceeds, which is what distinguishes this from a single-server
 * call. Identical aggregation is correct here: a meter reading is a fact the
 * nodes should agree on exactly. Agreement does not establish physical truth.
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
          url: `${cfg.meterApiBaseUrl}/api/iot/meter/${id}/history?days=${cfg.maxHistoryAgeDays}`,
          method: "GET",
        })
        .result();

      // Fail-closed: an unavailable endpoint yields no history, which screen()
      // rejects rather than waving through.
      if (!ok(cur) || !ok(hist)) return { history: [] } as Fetched;

      return {
        current: json(cur) as Reading,
        history: ((json(hist) as {history?:Reading[]}).history ?? json(hist)) as Reading[],
      } as Fetched;
    },
    consensusIdenticalAggregation<Fetched>(),
  );

  const meterIds: string[] = [];
  const readings: {meterId:string;start:bigint;end:bigint;kwh:bigint;evidenceHash:Hex;policyHash:Hex}[] = [];

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

    const outcome = screen(fetched.current, fetched.history, {...cfg,...cfg.meterPolicies?.[meterId]}, runtime.now().getTime());
    if ("reject" in outcome) {
      runtime.log(`${meterId}: rejected (${outcome.reject})`);
      continue;
    }
    runtime.log(`${meterId}: admitted (${outcome.kwh} kWh)`);
    // Operators must retain these receipts; a hash alone does not provide data availability.
    runtime.log(JSON.stringify({meterId,evidence:outcome.evidence,policy:outcome.policy}));
    meterIds.push(meterId);
    readings.push({meterId,start:BigInt(outcome.start),end:BigInt(outcome.end),kwh:BigInt(outcome.kwh),
      evidenceHash:keccak256(toBytes(outcome.evidence)),policyHash:keccak256(toBytes(outcome.policy))});
  }

  if (meterIds.length === 0) {
    runtime.log("no meter passed screening; no report submitted");
    return "no issuance";
  }

  // Structured report V2, decoded by RecDappCRE.Reading[].
  const payload: Hex = encodeAbiParameters(
    [{type:"tuple[]",components:[{name:"meterId",type:"string"},{name:"start",type:"uint64"},
      {name:"end",type:"uint64"},{name:"kwh",type:"uint256"},
      {name:"evidenceHash",type:"bytes32"},{name:"policyHash",type:"bytes32"}]}], [readings]);

  const report = runtime.report(prepareReportRequest(payload)).result();

  evmClient
    .writeReport(runtime, {
      receiver: cfg.consumerAddress,
      report,
      gasConfig: { gasLimit: cfg.gasLimit },
    })
    .result();

  runtime.log(`submitted ${meterIds.length} screened issuance(s)`);
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
