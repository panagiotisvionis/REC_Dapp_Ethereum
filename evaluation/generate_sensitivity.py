"""
generate_sensitivity.py — Regenerate sensitivity chart using actual evaluation data.
Uses identical pipeline to evaluate_auditor.py so numbers are consistent.
"""

import json
import math
import random
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import precision_recall_fscore_support

RESULTS_DIR = Path(__file__).parent / "results"
PARAMS_FILE = RESULTS_DIR / "entso_params.json"

# Thresholds to sweep
THRESHOLDS = [2.0, 2.5, 3.0, 3.5, 4.0]

# ── Load params ───────────────────────────────────────────────────────────────

with open(PARAMS_FILE) as f:
    data = json.load(f)
params = data["params"]

# ── Generate dataset (identical to evaluate_auditor.py) ──────────────────────

ANOMALY_TYPES = {
    "zero_reading":     lambda mu, sigma, rng: 0.0,
    "large_spike":      lambda mu, sigma, rng: mu + rng.uniform(5, 8) * sigma,
    "large_dropout":    lambda mu, sigma, rng: max(0, mu - rng.uniform(5, 8) * sigma),
    "moderate_spike":   lambda mu, sigma, rng: mu + rng.uniform(2.5, 4.5) * sigma,
    "sensor_stuck":     lambda mu, sigma, rng: mu * rng.uniform(0.05, 0.15),
    "night_generation": lambda mu, sigma, rng: mu + rng.uniform(3, 6) * max(sigma, 50),
}

def generate_dataset(n=1000, anomaly_rate=0.10, seed=42):
    rng    = np.random.default_rng(seed)
    py_rng = random.Random(seed)
    sources = list(params.keys())
    n_anom = int(n * anomaly_rate)
    n_normal = n - n_anom
    readings = []
    for _ in range(n_normal):
        src = py_rng.choice(sources)
        h   = py_rng.randint(0, 23)
        p   = params[src][str(h)]
        mu, sigma = p["mean"], max(p["std"], 1.0)
        val = float(rng.normal(mu, sigma))
        readings.append({"source": src, "hour": h, "production_kwh": max(0.0, round(val, 3)), "true_anomaly": 0})
    anom_types = list(ANOMALY_TYPES.keys())
    for _ in range(n_anom):
        src = py_rng.choice(sources)
        h   = py_rng.randint(0, 23)
        p   = params[src][str(h)]
        mu, sigma = p["mean"], max(p["std"], 1.0)
        if src == "Solar" and (h < 5 or h > 20):
            a_type = "night_generation"
            mu_eff, sigma_eff = 300.0, 80.0
        else:
            a_type = py_rng.choice(anom_types)
            mu_eff, sigma_eff = mu, sigma
        val = ANOMALY_TYPES[a_type](mu_eff, sigma_eff, rng)
        readings.append({"source": src, "hour": h, "production_kwh": max(0.0, round(val, 3)), "true_anomaly": 1})
    combined = list(zip(readings, [r["true_anomaly"] for r in readings]))
    py_rng.shuffle(combined)
    readings, _ = zip(*combined)
    readings = list(readings)
    labels = np.array([r["true_anomaly"] for r in readings])
    return readings, labels

def classify(readings, threshold):
    preds = []
    for r in readings:
        src = r["source"]
        h   = r["hour"]
        p   = params[src][str(h)]
        mu, sigma = p["mean"], max(p["std"], 1.0)
        z = abs((r["production_kwh"] - mu) / sigma)
        if src == "Solar" and (h < 5 or h > 20) and r["production_kwh"] < 1.0:
            preds.append(0)
            continue
        preds.append(1 if z >= threshold else 0)
    return np.array(preds)

# ── Run sweep ─────────────────────────────────────────────────────────────────

readings, y_true = generate_dataset()

results = {}
for t in THRESHOLDS:
    y_pred = classify(readings, t)
    prec, rec, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, pos_label=1, average="binary", zero_division=0
    )
    results[t] = {"precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4)}
    print(f"|z| ≥ {t}  Prec={prec:.4f}  Rec={rec:.4f}  F1={f1:.4f}")

# ── Plot ──────────────────────────────────────────────────────────────────────

thresholds = THRESHOLDS
precisions = [results[t]["precision"] for t in thresholds]
recalls    = [results[t]["recall"]    for t in thresholds]
f1s        = [results[t]["f1"]        for t in thresholds]

fig, ax = plt.subplots(figsize=(8, 4.5))

ax.plot(thresholds, precisions, "o-", color="#2563EB", lw=2.5, label="Precision", markersize=7)
ax.plot(thresholds, recalls,    "o-", color="#DC2626", lw=2.5, label="Recall",    markersize=7)
ax.plot(thresholds, f1s,        "o-", color="#16A34A", lw=2.5, label="F1 Score",  markersize=7)

# Annotate values
for x, y in zip(thresholds, precisions):
    ax.annotate(f"{y:.3f}", (x, y), textcoords="offset points", xytext=(0, 8),
                ha="center", fontsize=9, color="#2563EB", fontweight="bold")
for x, y in zip(thresholds, recalls):
    ax.annotate(f"{y:.3f}", (x, y), textcoords="offset points", xytext=(0, 8),
                ha="center", fontsize=9, color="#DC2626", fontweight="bold")
for x, y in zip(thresholds, f1s):
    ax.annotate(f"{y:.3f}", (x, y), textcoords="offset points", xytext=(0, -14),
                ha="center", fontsize=9, color="#16A34A", fontweight="bold")

# Mark operating point
ax.axvline(x=2.5, color="orange", linestyle="--", alpha=0.7, lw=1.5, label="Operating point (|z|≥2.5)")

ax.set_xticks(thresholds)
ax.set_xticklabels([f"|z| ≥ {t}" for t in thresholds])
ax.set_xlabel("z-score Threshold", fontsize=11)
ax.set_ylabel("Score", fontsize=11)
ax.set_title("Sensitivity Analysis: z-score Threshold vs. Performance Metrics\n"
             "(n=1000, anomaly_rate=10%, seed=42, ENTSO-E Greek grid parameters)", fontsize=11)
ax.legend(loc="lower right", fontsize=10)
ax.set_ylim(0.85, 1.05)
ax.grid(alpha=0.3)
fig.tight_layout()

out = RESULTS_DIR / "sensitivity_chart.png"
fig.savefig(out, dpi=150, bbox_inches="tight")
plt.close(fig)
print(f"\nSaved → {out}")

# Also save the data as JSON for paper reference
sensitivity_data = {
    "thresholds": thresholds,
    "results": {str(t): results[t] for t in thresholds},
    "note": "Generated with seed=42, n=1000, anomaly_rate=10%, ENTSO-E params"
}
with open(RESULTS_DIR / "sensitivity_data.json", "w") as f:
    json.dump(sensitivity_data, f, indent=2)
print("Saved → sensitivity_data.json")
