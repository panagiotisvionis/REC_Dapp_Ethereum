"""
calibration.py — Chronological calibration/test split, and threshold setting
from a benign corpus.

Two objections motivate this script.

(1) Hyperparameter leakage. The smoothing parameter lambda was swept on the
    same series used to report performance. The headline table happens to use
    the a priori default lambda = 0.3 rather than the sweep optimum, so the
    reported numbers are not tuned, but the recommendation of a value was.
    Here lambda is selected on an earlier calibration period and every
    reported figure comes from a later period never used for selection. The
    split is chronological, not random, because the data is a time series.

(2) Threshold calibration from too few samples. Setting an operating point to
    a false-alarm rate of 0.5 or 1 per cent cannot be done from the 30-sample
    detection window: the empirical quantile resolution of 30 observations is
    about 1/30, so a 0.5 per cent tail is not estimable from it. The detection
    window and the calibration corpus are therefore separated here. The window
    supplies the expected level; the threshold comes from a pool of
    standardised residuals over the whole calibration period, which is three
    orders of magnitude larger.

Usage:
    python3 calibration.py
"""

import json
from pathlib import Path

import numpy as np

import evaluate_real as ER

OUT = Path(__file__).parent / "results"
CAL_FRACTION = 0.40          # earliest 40% of days calibrates; the rest tests
LAMBDAS = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9]
TARGET_FAR = [0.01, 0.005, 0.001]
SEEDS = 12


def main():
    grids = ER.load_grid()
    values, wins, srcs, hours, dates = ER.build_table(grids)
    solar = srcs == "Solar"
    night = ER.solar_elevation(list(dates), hours.astype(float)) < -6.0
    cap = np.maximum(np.array([w.max() for w in wins]), 1.0)
    # As in evaluate_real.py, the 99th percentile covers the whole series,
    # including the test period. It sets only the magnitude of injected
    # night-time anomalies; lambda selection and thresholds never read it.
    for nm in np.unique(srcs):
        m = srcs == nm
        cap[m] = np.maximum(cap[m], np.percentile(values[m], 99))

    order = np.argsort([d.value for d in dates])
    cut = dates[order[int(len(order) * CAL_FRACTION)]]
    cal = np.array([d < cut for d in dates])
    tst = ~cal

    print("=" * 84)
    print("  Chronological split")
    print(f"  calibration : {min(dates)} .. {cut}   n = {cal.sum():,}")
    print(f"  test        : {cut} .. {max(dates)}   n = {tst.sum():,}")
    print("=" * 84)

    # ── (1) Select lambda on the calibration period only ─────────────────────
    def f1_at_budget(mask, lam, rate, seed):
        rng = np.random.default_rng(seed)
        v, y, _ = ER.inject(values, wins, srcs, hours, dates, rate, rng, night, cap)
        sc = ER.s_ewma(v, wins, night, solar, lam=lam) if lam is not None \
            else ER.s_z(v, wins, night, solar)
        sm, ym = sc[mask], y[mask]
        thr = np.percentile(sm[np.isfinite(sm)], 100 * (1 - rate))
        return ER.prf(ym, (sm >= thr).astype(int))[2]

    print("\n  Lambda selection on the CALIBRATION period (1% prevalence)")
    cal_scores = {}
    for lam in LAMBDAS:
        f = np.mean([f1_at_budget(cal, lam, 0.01, 4000 + s) for s in range(SEEDS)])
        cal_scores[lam] = f
        print(f"    lambda = {lam:<5} F1 = {f:.4f}")
    lam_star = max(cal_scores, key=cal_scores.get)
    print(f"  selected lambda* = {lam_star}  (calibration F1 = {cal_scores[lam_star]:.4f})")

    # ── Report on the untouched test period ──────────────────────────────────
    print("\n  Performance on the untouched TEST period")
    print(f"  {'prevalence':<12}{'z-score F1':>14}{'EWMA(lambda*) F1':>20}{'delta':>10}")
    test_rows = {}
    for rate in (0.005, 0.01, 0.05, 0.10):
        z = np.mean([f1_at_budget(tst, None, rate, 5000 + s) for s in range(SEEDS)])
        e = np.mean([f1_at_budget(tst, lam_star, rate, 5000 + s) for s in range(SEEDS)])
        test_rows[rate] = {"z": float(z), "ewma": float(e)}
        print(f"  {rate*100:>6.1f}%     {z:>14.3f}{e:>20.3f}{e-z:>+10.3f}")

    # ── (2) Threshold from a benign corpus, verified on the test period ──────
    print("\n  Threshold calibration on benign residuals only")
    rng = np.random.default_rng(99)
    z_all = ER.s_z(values, wins, night, solar)           # no anomalies injected
    e_all = ER.s_ewma(values, wins, night, solar, lam=lam_star)
    print(f"  calibration corpus: {int(np.isfinite(z_all[cal]).sum()):,} benign residuals"
          f"  (detection window is {ER.WINDOW} samples)")
    print(f"  {'target FAR':<12}{'z thr':>10}{'realised':>12}{'EWMA thr':>12}{'realised':>12}")
    far_rows = {}
    for far in TARGET_FAR:
        zt = np.percentile(z_all[cal][np.isfinite(z_all[cal])], 100 * (1 - far))
        et = np.percentile(e_all[cal][np.isfinite(e_all[cal])], 100 * (1 - far))
        zr = float((z_all[tst] >= zt).mean())
        er = float((e_all[tst] >= et).mean())
        far_rows[far] = {"z_thr": float(zt), "z_far": zr, "e_thr": float(et), "e_far": er}
        print(f"  {far*100:>6.2f}%     {zt:>10.2f}{zr*100:>11.2f}%{et:>12.2f}{er*100:>11.2f}%")

    print("\n  A 0.1% target needs a quantile the 30-sample window cannot resolve;")
    print("  the calibration corpus estimates it from three orders of magnitude more data.")

    (OUT / "calibration.json").write_text(json.dumps(
        {"cut": str(cut), "n_cal": int(cal.sum()), "n_test": int(tst.sum()),
         "cal_lambda_scores": {str(k): float(v) for k, v in cal_scores.items()},
         "lambda_star": lam_star, "test": {str(k): v for k, v in test_rows.items()},
         "far": {str(k): v for k, v in far_rows.items()}}, indent=2))
    print(f"\n  Written -> {OUT/'calibration.json'}")


if __name__ == "__main__":
    main()
