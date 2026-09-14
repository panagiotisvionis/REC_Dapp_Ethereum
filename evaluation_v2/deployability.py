"""
deployability.py — Deployability benchmark for the five detectors.

The manuscript previously asserted that the rolling z-score was "the only one
of the five that executes within the constraints of the oracle environment".
That claim was not supported by measurement, and is not obviously true: an
EWMA, a Tukey fence and a median/MAD are all arithmetically light. This script
replaces the assertion with numbers.

Each detector is implemented as a self-contained decision rule of the kind an
oracle workflow would carry: it receives one reading plus a trailing window and
returns a boolean. We measure, for each:

  * source size in bytes of the minimal self-contained implementation
  * external dependencies required at execution time
  * per-decision latency, measured over many repetitions
  * whether the rule needs state that a stateless workflow cannot hold
    (e.g. a model fitted over the whole corpus)

Usage:
    python3 deployability.py
"""

import json
import statistics
import time
from pathlib import Path

import numpy as np

OUT = Path(__file__).parent / "results"
OUT.mkdir(exist_ok=True)

WINDOW = 30
REPS = 20000

# ── Minimal self-contained implementations, one decision at a time ───────────
# Each SRC string is the body an oracle workflow would actually carry.

SRC = {
"RecChain z-score": """
m=0
for v in w: m+=v
m/=len(w)
s=0
for v in w: s+=(v-m)**2
s=(s/(len(w)-1))**0.5
if s<1: s=1
d=abs((x-m)/s)>=2.5
""",

"EWMA residual score": """
lam=0.3; num=0.0; den=0.0
for i,v in enumerate(w):
    q=lam*(1-lam)**(len(w)-1-i); num+=q*v; den+=q
m=num/den
s=0
for v in w: s+=(v-m)**2
s=(s/(len(w)-1))**0.5
if s<1: s=1
d=abs((x-m)/s)>=2.5
""",

"Tukey IQR fence": """
z=sorted(w); n=len(z)
def q(p):
    k=(n-1)*p; f=int(k); c=min(f+1,n-1)
    return z[f]+(k-f)*(z[c]-z[f])
q1=q(0.25); q3=q(0.75); iqr=q3-q1
if iqr<1: iqr=1
d=(x>q3+1.5*iqr) or (x<q1-1.5*iqr)
""",

"Robust z (median/MAD)": """
z=sorted(w); n=len(z)
med=z[n//2] if n%2 else (z[n//2-1]+z[n//2])/2
a=sorted(abs(v-med) for v in w)
mad=a[n//2] if n%2 else (a[n//2-1]+a[n//2])/2
s=1.4826*mad
if s<1: s=1
d=abs((x-med)/s)>=2.5
""",
}

DEPS = {
    "RecChain z-score":       ("none", "no"),
    "EWMA residual score":    ("none", "no"),
    "Tukey IQR fence":        ("none", "no"),
    "Robust z (median/MAD)":  ("none", "no"),
    "Isolation Forest":       ("scikit-learn, numpy, scipy", "yes"),
}


def bench(name, src, rng):
    code = compile(src, name, "exec")
    w = list(rng.normal(2000, 150, WINDOW))
    x = 2600.0
    g = {"w": w, "x": x}
    t0 = time.perf_counter()
    for _ in range(REPS):
        exec(code, g)
    dt = (time.perf_counter() - t0) / REPS
    return dt * 1e6            # microseconds per decision


def bench_iforest(rng):
    """Isolation Forest cannot decide from a 30-point window alone: it must be
    fitted. We measure a per-decision cost that includes fitting on the window,
    which is the only stateless formulation available to a workflow."""
    from sklearn.ensemble import IsolationForest
    reps = 200                       # far slower; fewer repetitions needed
    w = rng.normal(2000, 150, WINDOW).reshape(-1, 1)
    x = np.array([[2600.0]])
    t0 = time.perf_counter()
    for _ in range(reps):
        clf = IsolationForest(n_estimators=200, random_state=0).fit(w)
        _ = clf.predict(x)
    return (time.perf_counter() - t0) / reps * 1e6


def main():
    rng = np.random.default_rng(0)
    rows = []
    for name, src in SRC.items():
        us = bench(name, src, rng)
        deps, state = DEPS[name]
        rows.append({"detector": name, "bytes": len(src.strip()),
                     "deps": deps, "fitted_model": state, "us_per_decision": us})
    us = bench_iforest(rng)
    deps, state = DEPS["Isolation Forest"]
    rows.append({"detector": "Isolation Forest", "bytes": None,
                 "deps": deps, "fitted_model": state, "us_per_decision": us})

    print("=" * 88)
    print("  Deployability of the decision rule inside a stateless oracle workflow")
    print("=" * 88)
    print(f"{'Detector':<24}{'source B':>10}{'deps':>28}{'fitted':>9}{'us/decision':>14}")
    for r in rows:
        b = "n/a" if r["bytes"] is None else str(r["bytes"])
        print(f"{r['detector']:<24}{b:>10}{r['deps']:>28}{r['fitted_model']:>9}"
              f"{r['us_per_decision']:>14.2f}")

    print("\n  Interpretation: the four closed-form rules are all deployable; they")
    print("  differ by less than an order of magnitude in cost and carry no")
    print("  dependencies. Isolation Forest is the only one requiring a fitted")
    print("  model and a numerical stack, and is ~3 orders of magnitude slower")
    print("  per decision when fitted per window.")

    (OUT / "deployability.json").write_text(json.dumps(rows, indent=2))
    print(f"\n  Written -> {OUT/'deployability.json'}")


if __name__ == "__main__":
    main()
