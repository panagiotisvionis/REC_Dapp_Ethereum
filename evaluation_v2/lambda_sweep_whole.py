"""
lambda_sweep_whole.py — the smoothing-parameter sweep over the WHOLE measured
series, i.e. without the chronological split.

The manuscript reports that such a sweep would have suggested lambda = 0.7,
and that this is why lambda was instead selected on the calibration partition
alone (calibration.py). This script reproduces that statement with the same
injection, seeds (4000..4011), prevalence (1%) and matched-budget F1 as the
calibration-period selection, differing only in the mask: all readings.

Usage:
    python3 lambda_sweep_whole.py
"""
import json
from pathlib import Path

import numpy as np

import evaluate_real as ER

OUT = Path(__file__).parent / "results"
LAMBDAS = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9]
SEEDS = 12
RATE = 0.01


def main():
    grids = ER.load_grid()
    values, wins, srcs, hours, dates = ER.build_table(grids)
    solar = srcs == "Solar"
    night = ER.solar_elevation(list(dates), hours.astype(float)) < -6.0
    cap = np.maximum(np.array([w.max() for w in wins]), 1.0)
    for nm in np.unique(srcs):
        m = srcs == nm
        cap[m] = np.maximum(cap[m], np.percentile(values[m], 99))

    def f1(lam, seed):
        rng = np.random.default_rng(seed)
        v, y, _ = ER.inject(values, wins, srcs, hours, dates, RATE, rng, night, cap)
        sc = ER.s_ewma(v, wins, night, solar, lam=lam)
        thr = np.percentile(sc[np.isfinite(sc)], 100 * (1 - RATE))
        return ER.prf(y, (sc >= thr).astype(int))[2]

    print("  Lambda sweep over the whole measured series (no split), 1% prevalence, "
          f"seeds 4000..{4000 + SEEDS - 1}")
    scores = {}
    for lam in LAMBDAS:
        scores[lam] = float(np.mean([f1(lam, 4000 + s) for s in range(SEEDS)]))
        print(f"    lambda = {lam:<5} F1 = {scores[lam]:.4f}")
    best = max(scores, key=scores.get)
    print(f"  whole-series maximiser: lambda = {best}")
    (OUT / "lambda_sweep_whole.json").write_text(json.dumps(
        {"rate": RATE, "seeds": [4000 + s for s in range(SEEDS)],
         "f1": {str(k): v for k, v in scores.items()}, "lambda_best": best}, indent=2))
    print(f"  Written -> {OUT / 'lambda_sweep_whole.json'}")


if __name__ == "__main__":
    main()
