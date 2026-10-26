"""
evaluate_honest.py — Non-circular re-evaluation of the RecChain anomaly detector.

WHY THIS EXISTS
---------------
The original `evaluation/evaluate_auditor.py` draws every normal reading as
    x ~ N(mu[source][hour], sigma[source][hour])
and then scores it with
    z = (x - mu[source][hour]) / sigma[source][hour]
using the *same* mu and sigma. The detector is therefore handed the exact
parameters of the data-generating process. Consequently:

    P(|z| >= 2.5) for a standard normal = 0.01242
    expected false positives over 900 normal readings = 11.18
    reported false positives = 11

i.e. the published "Precision = 0.901 / FPR = 1.2%" is the analytic tail mass
of the normal distribution, not a property of the detector. Recall = 1.000 is
likewise guaranteed, because every injected anomaly is displaced by >= 2.5
sigma using that same sigma.

WHAT THIS SCRIPT DOES INSTEAD
-----------------------------
1. Builds a per-meter hourly time series over `--days` days, with
   autocorrelated day-to-day weather variability (the dominant source of
   variance in real PV/wind output), panel degradation, and measurement noise.
2. Estimates the baseline the way the DEPLOYED module does
   (`server/lib/auditor.js::generateHistory`): the trailing 30 days at the
   SAME hour of day. The detector never sees the generating parameters.
3. Scores several detectors on identical data, including baselines the
   original paper reports none of.
4. Repeats over `--seeds` independent seeds and reports mean +- 95% CI.
5. Reports PR-AUC alongside ROC-AUC. With 10% positives, ROC-AUC is
   optimistic; average precision is the honest summary statistic.

Usage:
    python3 evaluate_honest.py                 # 30 seeds, 180 days
    python3 evaluate_honest.py --seeds 50 --days 365
"""

import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import average_precision_score, roc_auc_score

OUT = Path(__file__).parent / "results"
OUT.mkdir(exist_ok=True)

# ── Meter fleet — mirrors server/lib/auditor.js::METERS ──────────────────────
METERS = [
    {"id": "METER_GR_001", "source": "Solar", "peak": 2000, "noise": 150, "degr": 0.0025},
    {"id": "METER_GR_002", "source": "Wind",  "peak": 3500, "noise": 400, "degr": 0.0010},
    {"id": "METER_GR_003", "source": "Hydro", "peak": 1800, "noise": 100, "degr": 0.0005},
    {"id": "METER_GR_004", "source": "Solar", "peak": 2200, "noise": 180, "degr": 0.0060},
    {"id": "METER_GR_005", "source": "Wind",  "peak": 4000, "noise": 500, "degr": 0.0015},
]

# Day-to-day weather variability (AR(1) multiplier). Solar is the most
# volatile (cloud cover), hydro the least (reservoir-buffered).
WEATHER = {"Solar": (0.85, 0.22), "Wind": (0.70, 0.35), "Hydro": (0.95, 0.08)}

WINDOW = 30          # trailing same-hour days, matches auditor.js
ANOMALY_RATE = 0.10


SUNRISE_UTC, SUNSET_UTC = 4, 17     # Greek daylight envelope, annual average

def production_curve(source: str, hour: int) -> float:
    """Deployed curve — server/lib/auditor.js::productionCurve.

    Solar follows a half-sine clear-sky profile that is zero at sunrise and
    sunset and peaks at the window midpoint, 10.5 UTC, which is solar noon for
    the Greek longitude range (19.4-28.2 E => 10.1-10.7 UTC). Wind and hydro
    carry a mild 24 h-periodic diurnal cycle, continuous across midnight.
    """
    if source == "Solar":
        if hour < SUNRISE_UTC or hour > SUNSET_UTC:
            return 0.0
        return float(np.sin(np.pi * (hour - SUNRISE_UTC) / (SUNSET_UTC - SUNRISE_UTC)))
    if source == "Wind":
        return 1 + 0.15 * np.sin(2 * np.pi * (hour - 6) / 24)
    return 1 + 0.05 * np.sin(2 * np.pi * (hour - 8) / 24)


def build_series(rng, days):
    """Return dict meter_id -> array[days, 24] of production in kWh."""
    series = {}
    for m in METERS:
        rho, vol = WEATHER[m["source"]]
        w = np.empty(days)
        w[0] = 1.0
        for d in range(1, days):                      # AR(1) weather factor
            w[d] = np.clip(rho * w[d - 1] + (1 - rho) * (1 + rng.normal(0, vol)), 0.05, 1.6)
        arr = np.empty((days, 24))
        for d in range(days):
            degr = 1 - m["degr"] * d
            for h in range(24):
                base = m["peak"] * production_curve(m["source"], h) * degr * w[d]
                arr[d, h] = max(0.0, base + rng.normal(0, m["noise"]))
        series[m["id"]] = arr
    return series


ANOMALIES = {
    "large_spike":      lambda v, s, rng: v + rng.uniform(5, 8) * s,
    "large_dropout":    lambda v, s, rng: max(0.0, v - rng.uniform(5, 8) * s),
    "moderate_spike":   lambda v, s, rng: v + rng.uniform(2.5, 4.5) * s,
    "sensor_stuck":     lambda v, s, rng: v * rng.uniform(0.05, 0.15),
    "zero_reading":     lambda v, s, rng: 0.0,
    "night_generation": lambda v, s, rng: rng.uniform(200, 500),
}


def make_dataset(seed, days):
    """Build the evaluation table: values, labels, and the trailing window."""
    rng = np.random.default_rng(seed)
    series = build_series(rng, days)

    rows = []   # (value, label, window[30], source, hour, atype)
    for m in METERS:
        arr = series[m["id"]]
        for d in range(WINDOW, days):
            for h in range(24):
                win = arr[d - WINDOW:d, h].copy()      # trailing 30 same-hour days
                rows.append([arr[d, h], 0, win, m["source"], h, "normal"])

    n_anom = int(len(rows) * ANOMALY_RATE)
    idx = rng.choice(len(rows), n_anom, replace=False)
    types = list(ANOMALIES)
    for i in idx:
        val, _, win, src, h, _ = rows[i]
        scale = max(win.std(ddof=1), 1.0)
        if src == "Solar" and (h < SUNRISE_UTC or h > SUNSET_UTC):
            at = "night_generation"                     # ghost night production
        else:
            at = types[rng.integers(0, len(types) - 1)]  # exclude night_generation
        rows[i] = [max(0.0, ANOMALIES[at](val, scale, rng)), 1, win, src, h, at]

    values = np.array([r[0] for r in rows])
    labels = np.array([r[1] for r in rows])
    wins   = np.stack([r[2] for r in rows])
    hours  = np.array([r[4] for r in rows])
    srcs   = np.array([r[3] for r in rows])
    atypes = np.array([r[5] for r in rows])
    return values, labels, wins, hours, srcs, atypes


# ── Detectors: each returns a continuous anomaly score (higher = more anomalous)
def score_zscore(values, wins, hours, srcs):
    mu = wins.mean(axis=1)
    sd = np.maximum(wins.std(axis=1, ddof=1), 1.0)
    z = np.abs((values - mu) / sd)
    night = (srcs == "Solar") & ((hours < SUNRISE_UTC) | (hours > SUNSET_UTC)) & (values < 1.0)
    z[night] = 0.0                                    # guard, as in auditor.js
    return z


def score_robust_z(values, wins, hours, srcs):
    med = np.median(wins, axis=1)
    mad = np.median(np.abs(wins - med[:, None]), axis=1)
    sd = np.maximum(1.4826 * mad, 1.0)
    z = np.abs((values - med) / sd)
    night = (srcs == "Solar") & ((hours < SUNRISE_UTC) | (hours > SUNSET_UTC)) & (values < 1.0)
    z[night] = 0.0
    return z


def score_iqr(values, wins, hours, srcs):
    q1 = np.percentile(wins, 25, axis=1)
    q3 = np.percentile(wins, 75, axis=1)
    iqr = np.maximum(q3 - q1, 1.0)
    upper = values - (q3 + 1.5 * iqr)
    lower = (q1 - 1.5 * iqr) - values
    s = np.maximum(upper, lower) / iqr
    night = (srcs == "Solar") & ((hours < SUNRISE_UTC) | (hours > SUNSET_UTC)) & (values < 1.0)
    s[night] = -np.inf
    return s


def score_ewma(values, wins, hours, srcs, lam=0.3):
    w = np.full(WINDOW, lam) * (1 - lam) ** np.arange(WINDOW - 1, -1, -1)
    w /= w.sum()
    mu = wins @ w
    sd = np.maximum(wins.std(axis=1, ddof=1), 1.0)
    s = np.abs((values - mu) / sd)
    night = (srcs == "Solar") & ((hours < SUNRISE_UTC) | (hours > SUNSET_UTC)) & (values < 1.0)
    s[night] = 0.0
    return s


def score_iforest(values, wins, hours, srcs, seed=0):
    mu = wins.mean(axis=1)
    sd = np.maximum(wins.std(axis=1, ddof=1), 1.0)
    X = np.column_stack([values, hours, (values - mu) / sd, values / np.maximum(mu, 1.0)])
    out = np.empty(len(values))
    for s in np.unique(srcs):
        m = srcs == s
        clf = IsolationForest(n_estimators=200, contamination=ANOMALY_RATE, random_state=seed)
        out[m] = -clf.fit(X[m]).score_samples(X[m])
    return out


DETECTORS = {
    "RecChain z-score (rolling)": score_zscore,
    "Robust z (median/MAD)":      score_robust_z,
    "Tukey IQR fence":            score_iqr,
    "EWMA residual score":        score_ewma,
    "Isolation Forest":           score_iforest,
}


def prf(labels, pred):
    tp = int(((pred == 1) & (labels == 1)).sum())
    fp = int(((pred == 1) & (labels == 0)).sum())
    fn = int(((pred == 0) & (labels == 1)).sum())
    tn = int(((pred == 0) & (labels == 0)).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f, fp / (fp + tn) if fp + tn else 0.0, tp, fp, fn, tn


def ci95(a):
    a = np.asarray(a, dtype=float)
    return a.mean(), 1.96 * a.std(ddof=1) / np.sqrt(len(a)) if len(a) > 1 else 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=30)
    ap.add_argument("--days", type=int, default=180)
    ap.add_argument("--threshold", type=float, default=2.5)
    a = ap.parse_args()

    acc = {name: {k: [] for k in ("P", "R", "F1", "FPR", "AP", "AUC")} for name in DETECTORS}
    sweep = {t: {"P": [], "R": [], "F1": [], "FPR": []} for t in (2.0, 2.5, 3.0, 3.5, 4.0)}
    by_type = {}
    n_report = 0

    for s in range(a.seeds):
        values, labels, wins, hours, srcs, atypes = make_dataset(1000 + s, a.days)
        n_report = len(values)
        for name, fn in DETECTORS.items():
            sc = fn(values, wins, hours, srcs, seed=s) if name == "Isolation Forest" \
                 else fn(values, wins, hours, srcs)
            # Every detector is thresholded to the SAME alarm budget, equal to
            # the anomaly rate. Mixing fixed thresholds for some detectors with
            # budget-matched thresholds for others makes the comparison, and
            # any significance test built on it, meaningless.
            finite_sc = sc[np.isfinite(sc)]
            k = np.percentile(finite_sc, 100 * (1 - ANOMALY_RATE))
            pred = (sc >= k).astype(int)
            if name == "RecChain z-score (rolling)":
                # The sweep is a separate, deliberately fixed-threshold study
                # of one detector; it is not part of the cross-detector table.
                for t in sweep:
                    p, r, f, fpr, *_ = prf(labels, (sc >= t).astype(int))
                    sweep[t]["P"].append(p); sweep[t]["R"].append(r)
                    sweep[t]["F1"].append(f); sweep[t]["FPR"].append(fpr)
                pred_fixed = (sc >= a.threshold).astype(int)
                for at in np.unique(atypes):
                    if at == "normal":
                        continue
                    m = atypes == at
                    by_type.setdefault(at, []).append(pred_fixed[m].mean())
            p, r, f, fpr, *_ = prf(labels, pred)
            finite = np.isfinite(sc)
            acc[name]["P"].append(p); acc[name]["R"].append(r)
            acc[name]["F1"].append(f); acc[name]["FPR"].append(fpr)
            acc[name]["AP"].append(average_precision_score(labels[finite], sc[finite]))
            acc[name]["AUC"].append(roc_auc_score(labels[finite], sc[finite]))

    print("=" * 86)
    print(f"  Honest re-evaluation — {a.seeds} seeds x {n_report:,} readings, "
          f"{int(ANOMALY_RATE*100)}% anomalies")
    print(f"  Baseline estimated from trailing {WINDOW} same-hour days (as deployed)")
    print("=" * 86)
    print(f"{'Detector':<28}{'Precision':>15}{'Recall':>15}{'F1':>15}{'PR-AUC':>13}")
    for name in DETECTORS:
        row = f"{name:<28}"
        for k in ("P", "R", "F1", "AP"):
            m, c = ci95(acc[name][k])
            row += f"{m:>9.3f}+-{c:<5.3f}" if k != "AP" else f"{m:>8.3f}+-{c:<4.3f}"
        print(row)

    print()
    print("  RecChain z-score — threshold sweep (mean +- 95% CI over seeds)")
    print(f"  {'|z|':<8}{'Precision':>16}{'Recall':>16}{'F1':>16}{'FPR':>16}")
    for t in sorted(sweep):
        r = f"  {t:<8.1f}"
        for k in ("P", "R", "F1", "FPR"):
            m, c = ci95(sweep[t][k])
            r += f"{m:>10.3f}+-{c:<5.3f}"
        print(r)

    print()
    print(f"  Detection rate by anomaly type at |z| >= {a.threshold}")
    for at in sorted(by_type):
        m, c = ci95(by_type[at])
        print(f"    {at:<20} {m*100:6.1f}% +- {c*100:.1f}")

    res = {
        "config": {"seeds": a.seeds, "days": a.days, "n_per_seed": n_report,
                   "window_days": WINDOW, "anomaly_rate": ANOMALY_RATE,
                   "threshold": a.threshold},
        "detectors": {n: {k: list(map(float, v)) for k, v in d.items()} for n, d in acc.items()},
        "sweep": {str(t): {k: list(map(float, v)) for k, v in d.items()} for t, d in sweep.items()},
        "by_anomaly_type": {k: float(np.mean(v)) for k, v in by_type.items()},
    }
    (OUT / "honest_evaluation.json").write_text(json.dumps(res, indent=2))
    print(f"\n  Written -> {OUT / 'honest_evaluation.json'}")


if __name__ == "__main__":
    main()

