# Anomaly-screening evaluation

Every number in Section 6 of the manuscript is produced by the scripts in this
directory. They are self-contained: paths resolve relative to the script, so
the directory can be run from anywhere.

Requirements: Python 3.10+ with `numpy`, `scipy`, `scikit-learn`, `pandas`;
Node.js 18+ for the JavaScript deployability benchmark.

## What produces what

Table and section numbers refer to the submitted manuscript.

| Script | Produces | Manuscript |
|---|---|---|
| `evaluate_honest.py` | Synthetic benchmark, 5 detectors x 30 seeds x 18,000 readings, matched alarm budget; threshold sweep; detection rate by category | Tables 3 and 5, Fig. 4 |
| `far_finner.py` | Friedman Aligned-Ranks + Finner post hoc over `results/honest_evaluation.json` | Table 4 |
| `evaluate_real.py` | Measured OPSD Greek generation, matched-budget and fixed-threshold regimes | Table 6, Sect. 6.4 |
| `paired_stats.py` | Paired EWMA residual score minus z-score comparison: 95% CIs and counts over the Table 6 replications, and over the chronological test period | Sect. 6.4, Remark 4 |
| `calibration.py` | Chronological calibration/test split, lambda selection, alert-rate calibration | Remark 4, Table 8 |
| `lambda_sweep_whole.py` | The same lambda sweep over the whole series without a split (maximiser lambda = 0.7) | Remark 4 |
| `deployability.py` | Source size, dependencies and per-decision latency for the five rules | Table 7 |
| `iforest_js/bench.js` | Dependency-free JavaScript isolation forest, timed per decision | Table 7 |
| `iforest_fair.py` | Isolation forest fitted on a corpus vs on the window (supporting analysis) | not tabulated |
| `derived_values.py` | Largest 95% CI half-width of the sweep; batch-dependent issuance cost, cost/value ratios and one-per-cent gas-price thresholds | Fig. 4 caption, Sects. 6.6 and 6.6.1 |

`far_finner.py` and `derived_values.py` read `results/honest_evaluation.json`,
and `paired_stats.py` reads `results/real_data_evaluation.json` and
`results/calibration.json`, so run the producing scripts first.
`derived_values.py` also reads `../evaluation/results/gas_table.json`, which
`npx hardhat test` regenerates from `test/gas_benchmark.js`. The REC value of
$3/MWh and the one-per-cent criterion in that script are the illustrative
assumptions stated in the manuscript; gas price and ETH/USD are read from the
gas file.

```bash
python3 evaluate_honest.py
python3 far_finner.py
python3 evaluate_real.py
python3 calibration.py
python3 paired_stats.py
python3 lambda_sweep_whole.py
python3 derived_values.py
python3 deployability.py        # timing: re-running re-measures latency
```

Committed outputs under `results/` are the runs the manuscript reports; each
`*_run.txt` is the console output of the corresponding script. The synthetic
scripts seed their generators, and the measured-data scripts are deterministic
given the input series, so these reproduce exactly. `deployability.py` measures
wall-clock latency, so a re-run gives slightly different timings; its committed
output predates the renaming of the EWMA detector and still lists it as
"EWMA control chart". The implemented statistic is the EWMA residual score of
Eqs. (7)-(8) of the manuscript, a finite-window exponentially weighted reference
level with an unweighted dispersion estimate, which is not a classical EWMA
control chart.

In `evaluate_real.py` and `calibration.py` the capacity proxy for injected
night-time generation uses the 99th percentile of each source over the whole
analysis window, including the reporting period. It scales only the injected
anomaly magnitude; no detector, threshold or parameter selection reads it.

## Data

`data/gr_generation_hourly.csv` is the Greek subset of the Open Power System
Data time series package, version 2020-10-06
(https://doi.org/10.25832/time_series/2020-10-06), covering 2018-01-01 to
2020-09-30 at hourly resolution. It is redistributed here under the terms of
that package so the evaluation is reproducible without a network fetch.

## Scope

These scripts characterise the screening statistic. They do not exercise the
on-chain path; contract behaviour is covered by the Hardhat suites in `test/`,
and the CRE workflow by `cre/screen.test.js` and `cre/integration.test.js`.
