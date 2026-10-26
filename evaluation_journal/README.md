# RecChain journal experiment, 26 October 2026

This directory contains a separate chronological experiment on three public PV
installations. It does not overwrite or reinterpret the archived national-series
injection experiment. The protocol was fixed before detector results; its
quality amendment was made after inspecting raw channel units and before scoring.

## Data and attribution

PVDAQ Public Datasets, National Renewable Energy Laboratory (2021),
DOI [10.25984/1846021](https://doi.org/10.25984/1846021), CC BY 4.0.
Source documentation: https://github.com/openEDI/documentation/blob/main/pvdaq.md.
The source snapshot is `systems_20250729.csv`. System IDs 34, 1199 and 1239 were
selected by ascending ID, reported quality `pass`, years >=2, capacity >=10 kW,
and the first distinct climate classes. Time zones are in the system metadata.

The full 2018 source download revealed a source discontinuity in August: factors
at systems 34 and 1239 change, while system 1199 loses its aggregate AC channel.
Rather than infer repairs, the common experiment ends at the last complete month,
July. Pre-August raw-to-kW factors are 0.1, 0.001 and 1.0, verified with the saved
metric metadata (calc_scale/1000). Power is integrated approximately from sampled
values. The source objects, their checksums, metadata and processing code are
identified in `data/`. Derived values and negative-load clipping are modifications
by Panagiotis Vionis; the original source does not endorse this analysis.

`pvdaq_hourly_2018.csv` is the processed January--July extract, despite the year
in its filename. The download manifest lists the complete year inspected for
quality. Cached raw files live outside this repository and are reproducible from
the public keys. Source file ordering does not affect processing.

## Reproduce

Python 3.12 and Node 24 were used. Install the root and workflow lockfiles first:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix cre/screening --ignore-scripts --no-audit --no-fund
python -m pip install -r evaluation_journal/requirements.txt
# Optional: download raw public data and regenerate the supplied hourly extract.
python evaluation_journal/fetch_pvdaq.py
# Reproduce the supplied results without downloading the daily files.
python evaluation_journal/evaluate_sites.py
node evaluation_journal/verify_workflow_scores.mjs
python evaluation_journal/build_paper_tables.py
python paper/analysis/verify_revision.py
npx hardhat test
node cre/screen.test.js
node cre/integration.test.js
npm run --prefix cre/screening typecheck
npx hardhat run scripts/gas-journal.js
```

WASM compilation additionally needs Bun. From `cre/screening`:

```sh
bun node_modules/@chainlink/cre-sdk/bin/cre-compile.ts main.ts /tmp/recchain-v2.wasm
```

This command builds; it does not deploy or simulate with a DON. The checked build
used Bun 1.4.4 and Javy 8.1.0. A toolchain build can download its verified compiler.
The build hash and local verification scope are recorded in `results/validation.json`.

## Design and interpretation

Calibration ends before 17 April UTC; testing ends before 1 August UTC. Thirty
prior same-UTC-hour values must exist within 45 days. All policies share a bound
of 1.2 times DC kW expressed as one-hour kWh. Rolling z uses 3; EWMA uses lambda
0.5 and a per-site 99th calibration percentile. The scale floor is 1 kWh. No test
quantile sets a threshold. Interventions use five relative transformations or
night ghost energy, independent of reference-window dispersion, with unchanged
transformations excluded from positive labels. `protocol.json` specifies seeds,
rates and the common quality rules. The code asserts that all window indices
are earlier and at the same UTC hour. Twelve real-data score fixtures cross-check
Python against the exact arithmetic imported by the workflow, tolerance 1e-10.

Both unmodified-reference and received-history modes are supplied. Received
history includes all previous interventions and flagged values; this is a stress
test without automatic cleansing. Confidence intervals describe twelve injection
seeds on these fixed series, not uncertainty over future sites or seasons.
Unmodified output is a reference with no certified natural-anomaly labels.

The sites are smaller than the hourly workflow's 1 MWh issuance floor. Monthly
batch equivalents are analytical outputs; an accumulator linking all screened
sub-MWh intervals into an issued batch is not implemented. The PV screening study
and local issuance report fixtures are separate experiments.

## Contract boundary

`RecDappCRE` trusts its configured forwarder and validates pinned workflow ID,
name and owner in 62/64-byte metadata. It consumes payloads, validates bound meters
and freshness, and calls the registry. DON signature checking is not emulated by
the gas fixture. `RecDappWorkflowRegistry` consumes exact intervals and rejects
overlap or out-of-order intervals per canonical meter identifier, even after
consumer rotation. State rolls back on failed minting. Workflow entry points use
reentrancy guards. Recorded evidence/policy hashes commit to logged JSON receipts;
operators must archive and provide the receipts to make later verification possible.
Hashes alone do not ensure availability or physical truth.

Manual and legacy issuers, administrators, aliases and other registries remain
separate trust boundaries. There is no physical device signature, revocation,
external registry reconciliation, live CRE deployment or independent security audit.
The API still serves simulated data. Sample configuration is illustrative and must
be calibrated per meter; `meterPolicies` can override threshold and maxKwh by ID.
V2 report encoding is incompatible with the archived receiver.

`gas_v2.json` records local execution only. The first report has different storage
costs from subsequent reports. Metadata lengths, meter IDs, quantities and state
affect gas. Oracle service, data retention, report transport and DON verification
are excluded. The older gas harness also reruns against the changed base contract;
its output files are current local measurements, not the archived release values.
