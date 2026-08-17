"""
iforest_fair.py — Is the isolation-forest advantage real, or an artefact of
transductive fitting?

In evaluate_real.py the isolation forest is fitted on the entire corpus and then
scores the same rows. Every other detector sees only the trailing 30-day
same-hour window for the reading under test. The comparison is therefore not
like for like: the forest has access to global structure, including the
distribution of the injected anomalies, that a per-reading workflow could never
observe.

This script separates two questions that the earlier result conflated.

  (a) Is an isolation forest deployable inside the oracle workflow?
      A dependency-free implementation in the workflow language is 1.7 kB and
      ~300 us per decision (see iforest_js/). It is deployable. The earlier
      claim in the manuscript, that it was excluded by execution cost, was
      wrong.

  (b) Does its accuracy advantage survive the restriction to window-local
      information, which is what a deployable variant would actually see?
      That is what this script measures, by scoring a per-window forest on the
      same rows, against the same baselines, on a common stratified subsample.

Usage:
    python3 iforest_fair.py --seeds 5 --sample 6000
"""

import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import average_precision_score

import evaluate_real as ER

OUT = Path(__file__).parent / "results"


# ── Per-window isolation forest, window-local information only ───────────────
def _c(n):
    if n <= 1:
        return 1.0
    return 2.0 * (np.log(n - 1) + 0.5772156649) - 2.0 * (n - 1) / n


def _path_len(x, col, lo, hi, depth, limit, rng):
    """Expected isolation depth of scalar x within sample `col`."""
    n = len(col)
    if depth >= limit or n <= 1 or lo >= hi:
        return depth + _c(n)
    split = rng.uniform(lo, hi)
    if x < split:
        m = col < split
        return _path_len(x, col[m], lo, split, depth + 1, limit, rng)
    m = col >= split
    return _path_len(x, col[m], split, hi, depth + 1, limit, rng)


def iforest_window_score(values, wins, n_trees=64, seed=0):
    """Score each reading against a forest grown on its own trailing window."""
    rng = np.random.default_rng(seed)
    out = np.empty(len(values))
    for i in range(len(values)):
        w = wins[i]
        lo, hi = float(w.min()), float(w.max())
        x = float(values[i])
        lo, hi = min(lo, x), max(hi, x)
        limit = int(np.ceil(np.log2(max(len(w), 2))))
        tot = 0.0
        for _ in range(n_trees):
            tot += _path_len(x, w, lo, hi, 0, limit, rng)
        out[i] = 2.0 ** (-(tot / n_trees) / _c(len(w)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=5)
    ap.add_argument("--sample", type=int, default=6000)
    a = ap.parse_args()

    grids = ER.load_grid()
    values, wins, srcs, hours, dates = ER.build_table(grids)
    solar = srcs == "Solar"
    elev = ER.solar_elevation(list(dates), hours.astype(float))
    is_night = elev < -6.0
    cap = np.maximum(np.array([w.max() for w in wins]), 1.0)
    for nm in np.unique(srcs):
        m = srcs == nm
        cap[m] = np.maximum(cap[m], np.percentile(values[m], 99))

    print("=" * 90)
    print("  Isolation forest: corpus-fitted vs window-fitted, common subsample")
    print(f"  subsample {a.sample:,} readings x {a.seeds} seeds")
    print("=" * 90)

    res = {}
    for rate in (0.005, 0.01, 0.10):
        acc = {k: {"P": [], "R": [], "F1": [], "AP": []} for k in
               ("z-score", "EWMA", "IForest (corpus fit)", "IForest (window fit)")}
        for s in range(a.seeds):
            rng = np.random.default_rng(7000 + s)
            v, y, _ = ER.inject(values, wins, srcs, hours, dates, rate, rng, is_night, cap)

            # Common stratified subsample, identical for every detector.
            pos = np.flatnonzero(y == 1); neg = np.flatnonzero(y == 0)
            n_pos = max(1, int(a.sample * rate))
            take = np.concatenate([
                rng.choice(pos, min(n_pos, len(pos)), replace=False),
                rng.choice(neg, a.sample - min(n_pos, len(pos)), replace=False)])
            rng.shuffle(take)

            vv, ww, yy = v[take], wins[take], y[take]
            nn, ss = is_night[take], solar[take]

            scores = {
                "z-score":              ER.s_z(vv, ww, nn, ss),
                "EWMA":                 ER.s_ewma(vv, ww, nn, ss),
                "IForest (corpus fit)": ER.s_iforest(vv, ww, nn, ss, seed=s),
                "IForest (window fit)": iforest_window_score(vv, ww, seed=s),
            }
            for name, sc in scores.items():
                k = np.percentile(sc, 100 * (1 - rate))
                pred = (sc >= k).astype(int)
                p, r, f = ER.prf(yy, pred)
                fin = np.isfinite(sc)
                acc[name]["P"].append(p); acc[name]["R"].append(r); acc[name]["F1"].append(f)
                acc[name]["AP"].append(average_precision_score(yy[fin], sc[fin]))

        res[str(rate)] = {k: {m: list(map(float, val)) for m, val in d.items()}
                          for k, d in acc.items()}
        print(f"\n  Prevalence {rate*100:g}%   (threshold set to the alarm budget)")
        print(f"  {'Detector':<24}{'Precision':>15}{'Recall':>15}{'F1':>15}{'AP':>14}")
        for k, d in acc.items():
            row = f"  {k:<24}"
            for m in ("P", "R", "F1"):
                mu, c = ER.ci(d[m]); row += f"{mu:>9.3f}+-{c:<5.3f}"
            mu, c = ER.ci(d["AP"]); row += f"{mu:>9.3f}+-{c:<4.3f}"
            print(row)

    (OUT / "iforest_fair.json").write_text(json.dumps(res, indent=2))
    print(f"\n  Written -> {OUT/'iforest_fair.json'}")


if __name__ == "__main__":
    main()
