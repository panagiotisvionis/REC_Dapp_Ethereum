# Anomaly-screening evaluation

Every number in Section 6 of the manuscript is produced by the scripts in this
directory. They are self-contained: paths resolve relative to the script, so
the directory can be run from anywhere.

Requirements: Python 3.10+ with `numpy`, `scipy`, `scikit-learn`, `pandas`;
Node.js 18+ for the JavaScript deployability benchmark.

## What produces what

| Script | Produces | Manuscript |
|---|---|---|
| `evaluate_honest.py` | Synthetic benchmark, 5 detectors x 30 seeds x 18,000 hours, single matched-budget regime | Table 4 |
| `far_finner.py` | Friedman Aligned-Ranks + Finner post hoc over `results/honest_evaluation.json` | Sect. 6.3 |
| `evaluate_real.py` | Measured OPSD Greek generation, matched-budget and fixed-threshold regimes | Table 5, Sect. 6.4 |
| `calibration.py` | Chronological calibration/test split, EWMA lambda selection, alert-rate calibration | Sect. 6.5.1 |
| `deployability.py` | Bundle size, dependency count and per-decision latency for all five detectors | Sect. 6.5 |
| `iforest_fair.py` | Isolation Forest under the same trailing-window protocol as the other detectors | Sect. 6.3 |
| `iforest_js/bench.js` | Dependency-free JavaScript isolation forest, timed per decision | Sect. 6.5 |

Run order matters in one place only: `far_finner.py` reads
`results/honest_evaluation.json`, so run `evaluate_honest.py` first.

```bash
python3 evaluate_honest.py     # then
python3 far_finner.py
python3 evaluate_real.py
python3 calibration.py
python3 deployability.py
```

Committed outputs under `results/` are the exact runs the manuscript reports;
re-running overwrites them. The synthetic scripts seed their generators, so
they reproduce bit-for-bit. `evaluate_real.py` and `calibration.py` are
deterministic given the input series.

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
