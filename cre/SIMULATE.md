# Running the CRE simulation

Everything below is prepared; the simulation itself needs CRE credentials, which
gate both `cre init` and `cre workflow simulate`.

> **Working directory.** All paths here are relative to the repository root:
> `~/Desktop/Panagiotis/Projects/REC_Dapp_Ethereum`
> — *not* the manuscript directory `~/Desktop/Panagiotis/papers/RecChain`.
> Start with `cd ~/Desktop/Panagiotis/Projects/REC_Dapp_Ethereum`.

## Project layout

The canonical CRE implementation is **`cre/screening/main.ts`**. There is no
other CRE workflow in this repository.

```
cre/
  project.yaml            CRE project settings (RPCs per target)
  secrets.yaml            secret names; empty for this workflow
  mock-meter-api.js       deterministic IoT endpoint for simulation
  screen.test.js          screening-rule unit tests (9)
  integration.test.js     fetch-and-screen against a live endpoint (8)
  screening/
    main.ts               THE workflow
    workflow.yaml         workflow settings per target
    config.staging.json   operating parameters (threshold, lambda, meters)
    config.production.json
```

## Prerequisites

1. **CRE CLI.** Already installed at `~/.local/bin/cre` (v1.30.0). To reinstall:
   ```bash
   curl -sSL -o /tmp/cre.tgz \
     https://github.com/smartcontractkit/cre-cli/releases/download/v1.30.0/cre_linux_amd64.tar.gz
   tar xzf /tmp/cre.tgz -C /tmp
   mkdir -p ~/.local/bin && mv /tmp/cre_v1.30.0_linux_amd64 ~/.local/bin/cre
   chmod +x ~/.local/bin/cre
   cre version          # note: `version`, not `--version`
   ```
2. **Credentials.** Either `cre login` (opens a browser OAuth flow), or export a
   key. Paste the key itself — angle brackets are shell redirects and will
   produce a syntax error:
   ```bash
   export CRE_API_KEY=ck_live_abc123...     # NOT <your key>
   ```

## Run

```bash
# Terminal 1 — the meter endpoint the workflow fetches from
cd ~/Desktop/Panagiotis/Projects/REC_Dapp_Ethereum
node cre/mock-meter-api.js
# expect: mock meter API on http://localhost:3001

# Terminal 2 — the simulation
cd ~/Desktop/Panagiotis/Projects/REC_Dapp_Ethereum/cre
export CRE_API_KEY=ck_live_abc123...   # your actual key, no angle brackets
npm install --prefix screening         # or: bun install --cwd ./screening
cre workflow simulate screening \
  --target staging-settings --non-interactive --trigger-index 0
```

Requires **Bun** on PATH (`npm install -g bun`); the CLI uses it to compile the
TypeScript workflow to WASM.

To exercise the rejection path instead, restart the endpoint from the
repository root with `node cre/mock-meter-api.js --anomaly`, which inflates
METER_GR_001 fourfold.
Expected log: `METER_GR_001: rejected (score above threshold)` and a report
carrying only the other two meters.

## What is already verified, and what is not

| | Status |
|---|---|
| TypeScript type-checks against `@chainlink/cre-sdk@1.19.1` | `npm run typecheck` (from `cre/screening/`) — 0 errors |
| Screening rule unit tests | `node cre/screen.test.js` (from the repo root) — 9/9 |
| Consumer contract unit tests | `npx hardhat test test/RecDappCRE.test.js` — 11/11 |
| Consumer and registry integration | `npx hardhat test test/CREIntegration.test.js` — 7/7 |
| Fetch-and-screen against a live endpoint | `node cre/integration.test.js` (from the repo root) — 8/8 |
| Execution inside the CRE runtime | `cre workflow simulate screening` — passes, three scenarios (see below) |
| **Deployment to a CRE registry** | **not done; requires `cre account access`** |

## Simulation results (recorded 2026-08-17, CRE CLI v1.30.0)

```
### 1. normal operation
  METER_GR_001: admitted (2123 kWh)
  METER_GR_002: admitted (3163 kWh)
  METER_GR_003: admitted (1717 kWh)
  -> "submitted 3 issuance(s)"

### 2. anomaly on METER_GR_001 (4x inflation)
  METER_GR_001: rejected (score above threshold)
  METER_GR_002: admitted (3163 kWh)
  METER_GR_003: admitted (1717 kWh)
  -> "submitted 2 issuance(s)"

### 3. endpoint unreachable
  METER_GR_001: rejected (endpoint unreachable)
  METER_GR_002: rejected (endpoint unreachable)
  METER_GR_003: rejected (endpoint unreachable)
  -> "no issuance"
```

Reproduce with `bash /tmp/simrun.sh`-style sequencing, or manually by starting
`node cre/mock-meter-api.js` (optionally `--anomaly`) and running
`cre workflow simulate screening --target staging-settings --non-interactive
--trigger-index 0` from `cre/`.

**What simulation caught that the unit tests did not.** A transport failure
raises before the `ok()` status guard can run, so an unreachable endpoint
originally aborted the whole execution instead of rejecting the affected meter.
Fail-closed either way, but one dead endpoint suppressed issuance for every
other meter. Now contained per meter.

## Manuscript status (already applied)

The manuscript has been updated at four places to reflect the above. Kept
deliberately narrow — a local simulation is not a deployment:

- **§5.2** — replace *"and they are not executed in the CRE runtime. Neither
  registration nor `cre workflow simulate` was available to us…"* with
  *"and the workflow executes successfully under local simulation using the
  Chainlink CRE CLI v1.30.0. It has not been registered with a CRE deployment,
  so no claim is made about production behaviour, DON latency or live oracle
  validation."*
- **§6.5** — *"— subject to the runtime confirmation that remains outstanding"*
  becomes *", confirmed under local simulation"*; and *"none of the five has
  been run inside the CRE runtime"* becomes *"each has been exercised under
  local simulation"*.
- **Conclusion** — *"neither has been executed in the CRE runtime, and no
  latency or runtime claim is made for them"* becomes *"both execute under
  local simulation; neither has been deployed, and no latency claim is made"*.
- **§8.3** — *"nor is any latency claimed for the revised workflow, which has
  not been executed"* becomes *"…which has been simulated but not deployed"*.

The manuscript says "executes successfully under local simulation" and states
explicitly that the workflow has not been registered with a CRE deployment, so
no claim is made about production behaviour, network latency or live oracle
validation. Do not upgrade that wording to "runtime validated" or "production
ready", and do not quote a latency figure: the DON round-trip is not measured
by a local simulation.

## Configuration

`config.json` carries the operating parameters. `threshold: 3.48` is the value
Table 8 of the manuscript calibrates for a 0.5% alert rate on the EWMA
statistic; `lambda: 0.5` is the value selected on the chronological calibration
split. Neither should be changed without re-running
`evaluation_v2/calibration.py`.
