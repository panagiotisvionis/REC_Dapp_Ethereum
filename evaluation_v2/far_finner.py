"""
Friedman Aligned-Ranks (FAR) + Finner post hoc on the honest detector comparison.
Mirrors the statistical protocol of Vionis et al., Electrical Engineering 108:69 (2026),
so that the two papers are directly comparable in methodology.
"""
import json, numpy as np
from pathlib import Path
from scipy.stats import chi2, rankdata, norm

d = json.load(open(Path(__file__).parent / "results" / "honest_evaluation.json"))
names = list(d["detectors"])
X = np.array([d["detectors"][n]["F1"] for n in names])   # k detectors x n seeds
k, n = X.shape

# --- Friedman Aligned Ranks -------------------------------------------------
loc = X.mean(axis=0)                       # per-seed location
A = X - loc                                # aligned observations
R = rankdata(-A.ravel()).reshape(k, n)     # rank descending: rank 1 = best F1
Rj = R.mean(axis=1)                        # average aligned rank per detector
Rhat_j = R.sum(axis=1)
Rhat_i = R.sum(axis=0)

num = (k - 1) * (np.sum(Rhat_j**2) - (k * n**2 / 4) * (k * n + 1)**2 / (k * n))
den = (k * n * (k * n + 1) * (2 * k * n + 1)) / 6 - np.sum(Rhat_i**2) / k
T = num / den
p_far = 1 - chi2.cdf(T, k - 1)

order = np.argsort(Rj)
print("=" * 74)
print(f"  Friedman Aligned-Ranks — {k} detectors x {n} replications (F1 score)")
print("=" * 74)
print(f"{'Detector':<30}{'FAR':>10}{'mean F1':>12}")
for i in order:
    print(f"{names[i]:<30}{Rj[i]:>10.2f}{X[i].mean():>12.4f}")
print(f"\n  FAR statistic T = {T:.3f}, df = {k-1}, p = {p_far:.3e}")

# --- Finner post hoc, control = best-ranked detector ------------------------
ctrl = order[0]
se = np.sqrt(k * (n * k + 1) / 6.0)
raw = {}
for i in order[1:]:
    z = abs(Rj[ctrl] - Rj[i]) / se
    raw[i] = 2 * (1 - norm.cdf(z))

idx = sorted(raw, key=lambda i: raw[i])
m = len(idx)
adj, run = {}, 0.0
for rank, i in enumerate(idx, start=1):
    val = 1 - (1 - raw[i]) ** (m / rank)
    run = max(run, val)                     # enforce monotonicity
    adj[i] = min(run, 1.0)

print(f"\n  Finner post hoc (control = {names[ctrl]}, alpha = 0.05)")
print(f"  {'Comparison':<30}{'z':>8}{'p':>12}{'p_Finner':>12}   H0")
for i in idx:
    z = abs(Rj[ctrl] - Rj[i]) / se
    verdict = "Reject" if adj[i] < 0.05 else "Retain"
    print(f"  {names[i]:<30}{z:>8.3f}{raw[i]:>12.3e}{adj[i]:>12.3e}   {verdict}")

json.dump({"far": {names[i]: float(Rj[i]) for i in range(k)},
           "T": float(T), "p_far": float(p_far), "control": names[ctrl],
           "finner": {names[i]: float(adj[i]) for i in adj}},
          open(Path(__file__).parent / "results" / "far_finner.json", "w"), indent=2)
print("\n  Written -> results/far_finner.json")
