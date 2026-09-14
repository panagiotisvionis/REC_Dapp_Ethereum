"""Paired EWMA - z-score comparison on the measured-data replications.
(a) Table 5, matched budget: per-seed F1 read from results/real_data_evaluation.json.
(b) Chronological test period: per-seed F1 regenerated with the exact code path of
    calibration.py (same injection, seeds 5000..5011, lambda*=0.5); means checked
    against results/calibration.json before any statistic is reported."""
import json, sys
import numpy as np
from scipy import stats
from pathlib import Path
E = str(Path(__file__).parent)
sys.path.insert(0, E)
import evaluate_real as ER

def paired(e, z):
    d = np.asarray(e) - np.asarray(z); n = len(d)
    m, sd = d.mean(), d.std(ddof=1); h = stats.t.ppf(0.975, n - 1) * sd / np.sqrt(n)
    w = stats.wilcoxon(e, z, alternative="two-sided")
    return dict(n=n, mean=m, lo=m - h, hi=m + h, pos=int((d > 0).sum()), wil_p=w.pvalue, dmin=d.min(), dmax=d.max())

res = json.load(open(f"{E}/results/real_data_evaluation.json"))["results"]
print("(a) whole series, matched budget, EWMA lambda=0.3, 30 replications")
out = {"table5": {}, "test": {}}
for r in ("0.005", "0.01", "0.05", "0.1"):
    e = res[r]["EWMA residual score"]["F1"]; z = res[r]["RecChain z-score (rolling)"]["F1"]
    p = paired(e, z); out["table5"][r] = p
    print(f"  {float(r)*100:>4g}%  dF1={p['mean']:+.4f}  95% CI [{p['lo']:+.4f}, {p['hi']:+.4f}]  EWMA higher {p['pos']}/{p['n']}  Wilcoxon p={p['wil_p']:.2e}  range [{p['dmin']:+.3f},{p['dmax']:+.3f}]")

grids = ER.load_grid()
values, wins, srcs, hours, dates = ER.build_table(grids)
solar = srcs == "Solar"
night = ER.solar_elevation(list(dates), hours.astype(float)) < -6.0
cap = np.maximum(np.array([w.max() for w in wins]), 1.0)
for nm in np.unique(srcs):
    m = srcs == nm; cap[m] = np.maximum(cap[m], np.percentile(values[m], 99))
order = np.argsort([d.value for d in dates]); cut = dates[order[int(len(order) * 0.40)]]
tst = ~np.array([d < cut for d in dates])
def f1(mask, lam, rate, seed):
    rng = np.random.default_rng(seed)
    v, y, _ = ER.inject(values, wins, srcs, hours, dates, rate, rng, night, cap)
    sc = ER.s_ewma(v, wins, night, solar, lam=lam) if lam is not None else ER.s_z(v, wins, night, solar)
    sm, ym = sc[mask], y[mask]
    thr = np.percentile(sm[np.isfinite(sm)], 100 * (1 - rate))
    return ER.prf(ym, (sm >= thr).astype(int))[2]
cal = json.load(open(f"{E}/results/calibration.json"))["test"]
print("(b) chronological test period, EWMA lambda*=0.5, 12 replications")
for r in (0.005, 0.01, 0.05, 0.10):
    z = [f1(tst, None, r, 5000 + s) for s in range(12)]
    e = [f1(tst, 0.5, r, 5000 + s) for s in range(12)]
    key = str(r); ok = abs(np.mean(z) - cal[key]["z"]) < 1e-12 and abs(np.mean(e) - cal[key]["ewma"]) < 1e-12
    p = paired(e, z); out["test"][key] = p
    print(f"  {r*100:>4g}%  reproduces calibration.json: {ok}  dF1={p['mean']:+.4f}  95% CI [{p['lo']:+.4f}, {p['hi']:+.4f}]  EWMA higher {p['pos']}/{p['n']}  Wilcoxon p={p['wil_p']:.2e}")
json.dump(out, open(f"{E}/results/paired_ewma_vs_z.json", "w"), indent=2, default=float)
