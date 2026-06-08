"""
evaluate_auditor.py — Evaluate RecChain AI Auditor (z-score classifier)

Pipeline:
  1. Load hour-of-day parameters from results/entso_params.json
     (run fetch_entso.py first, or it falls back to literature params inline)
  2. Generate 1000 synthetic IoT readings with 10% labelled anomalies
  3. Run z-score classifier (matches auditor.js logic exactly)
  4. Output confusion matrix + precision/recall/F1 + plots

Usage:
    cd evaluation/
    python fetch_entso.py          # optional; uses literature params if skipped
    python evaluate_auditor.py
    python evaluate_auditor.py --n 5000 --anomaly_rate 0.15 --seed 99

Output files (evaluation/results/):
    confusion_matrix.png
    roc_curve.png
    evaluation_report.json
    evaluation_report.txt
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    confusion_matrix, classification_report,
    precision_recall_fscore_support, roc_auc_score, roc_curve,
    ConfusionMatrixDisplay,
)

RESULTS_DIR = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)
PARAMS_FILE = RESULTS_DIR / "entso_params.json"

# ─── Z-score thresholds (mirrors auditor.js) ─────────────────────────────────
THRESHOLD_SUSPICIOUS = 2.5
THRESHOLD_FLAGGED    = 4.0

# "anomaly" = any reading the auditor flags (|z| ≥ 2.5)
CLASSIFY_THRESHOLD   = THRESHOLD_SUSPICIOUS


# ─── Load / fallback parameters ───────────────────────────────────────────────

def load_params() -> dict:
    if PARAMS_FILE.exists():
        with open(PARAMS_FILE) as f:
            data = json.load(f)
        print(f"Loaded parameters from: {data['source']}")
        return data["params"]

    # Inline literature fallback (same as fetch_entso.py::literature_params)
    print("entso_params.json not found — using inline literature parameters.")
    params = {"Solar": {}, "Wind": {}, "Hydro": {}}
    for h in range(24):
        if h < 5 or h > 20:
            mean_s, std_s = 0.0, 30.0
        else:
            intensity  = np.exp(-0.5 * ((h - 10) / 4.0) ** 2)
            mean_s = 2000 * intensity
            std_s  = max(30, 150 * intensity)
        params["Solar"][str(h)] = {"mean": round(mean_s, 2), "std": round(std_s, 2)}

        base_w = 0.68 + 0.32 * np.sin(h / 3.0)
        params["Wind"][str(h)] = {
            "mean": round(3500 * base_w, 2),
            "std":  round(400  * (0.7 + 0.3 * base_w), 2),
        }

        base_h = 0.82 + 0.18 * np.sin(h / 4.0)
        params["Hydro"][str(h)] = {
            "mean": round(1800 * base_h, 2),
            "std":  round(100  * base_h, 2),
        }
    return params


# ─── Synthetic data generator ─────────────────────────────────────────────────

ANOMALY_TYPES = {
    "zero_reading":       lambda mu, sigma, rng: 0.0,
    "large_spike":        lambda mu, sigma, rng: mu + rng.uniform(5, 8) * sigma,
    "large_dropout":      lambda mu, sigma, rng: max(0, mu - rng.uniform(5, 8) * sigma),
    "moderate_spike":     lambda mu, sigma, rng: mu + rng.uniform(2.5, 4.5) * sigma,
    "sensor_stuck":       lambda mu, sigma, rng: mu * rng.uniform(0.05, 0.15),
    "night_generation":   lambda mu, sigma, rng: mu + rng.uniform(3, 6) * max(sigma, 50),
}


def generate_dataset(params: dict, n: int, anomaly_rate: float, seed: int):
    """
    Returns:
      readings : list of dicts  {source, hour, production_kwh, true_anomaly, anomaly_type}
      labels   : np.ndarray[int]  1=anomaly, 0=normal  (ground truth)
    """
    rng    = np.random.default_rng(seed)
    py_rng = random.Random(seed)

    sources  = list(params.keys())
    n_anom   = int(n * anomaly_rate)
    n_normal = n - n_anom

    readings = []

    # Normal readings
    for _ in range(n_normal):
        src  = py_rng.choice(sources)
        h    = py_rng.randint(0, 23)
        p    = params[src][str(h)]
        mu, sigma = p["mean"], max(p["std"], 1.0)
        val  = float(rng.normal(mu, sigma))
        val  = max(0.0, val)
        readings.append({
            "source": src, "hour": h,
            "production_kwh": round(val, 3),
            "true_anomaly": 0, "anomaly_type": "normal",
        })

    # Anomalous readings
    anom_types = list(ANOMALY_TYPES.keys())
    for _ in range(n_anom):
        src  = py_rng.choice(sources)
        h    = py_rng.randint(0, 23)
        p    = params[src][str(h)]
        mu, sigma = p["mean"], max(p["std"], 1.0)

        # Night-generation anomaly only for Solar (biologically plausible)
        if src == "Solar" and (h < 5 or h > 20):
            a_type = "night_generation"
            mu_eff, sigma_eff = 300.0, 80.0  # ghost production at night
        else:
            a_type = py_rng.choice(anom_types)
            mu_eff, sigma_eff = mu, sigma

        val = ANOMALY_TYPES[a_type](mu_eff, sigma_eff, rng)
        val = max(0.0, val)
        readings.append({
            "source": src, "hour": h,
            "production_kwh": round(val, 3),
            "true_anomaly": 1, "anomaly_type": a_type,
        })

    # Shuffle
    combined = list(zip(readings, [r["true_anomaly"] for r in readings]))
    py_rng.shuffle(combined)
    readings, _ = zip(*combined)
    readings = list(readings)
    labels   = np.array([r["true_anomaly"] for r in readings])

    return readings, labels


# ─── Z-score classifier (matches auditor.js) ──────────────────────────────────

def normalcdf(x: float) -> float:
    """Abramowitz & Stegun approximation — identical to auditor.js."""
    sign = 1 if x >= 0 else -1
    x    = abs(x)
    t    = 1.0 / (1.0 + 0.2316419 * x)
    y    = (((( 1.330274429 * t
              - 1.821255978) * t
              + 1.781477937) * t
              - 0.356563782) * t
              + 0.319381530) * t
    return 0.5 + sign * (0.5 - y * math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi))


def zscore_classifier(readings: list, params: dict) -> np.ndarray:
    """
    Returns predicted labels (1 = anomaly, 0 = normal).
    Uses |z| ≥ CLASSIFY_THRESHOLD as the decision boundary.
    """
    predictions = []
    scores      = []

    for r in readings:
        src = r["source"]
        h   = r["hour"]
        p   = params[src][str(h)]
        mu, sigma = p["mean"], max(p["std"], 1.0)

        z    = (r["production_kwh"] - mu) / sigma
        absz = abs(z)
        scores.append(absz)

        # Night-time zero-production for solar is normal — guard identical to auditor.js
        if src == "Solar" and (h < 5 or h > 20):
            if r["production_kwh"] < 1.0:
                predictions.append(0)
                continue

        pred = 1 if absz >= CLASSIFY_THRESHOLD else 0
        predictions.append(pred)

    return np.array(predictions), np.array(scores)


# ─── Evaluation & reporting ───────────────────────────────────────────────────

def plot_confusion_matrix(y_true, y_pred, out_path: Path):
    cm  = confusion_matrix(y_true, y_pred)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm,
                                   display_labels=["Normal", "Anomaly"])
    fig, ax = plt.subplots(figsize=(5, 4))
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title(f"RecChain AI Auditor — Confusion Matrix\n"
                 f"(z-score threshold |z| ≥ {CLASSIFY_THRESHOLD})")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  Saved → {out_path.name}")


def plot_roc(y_true, scores, out_path: Path):
    fpr, tpr, thresholds = roc_curve(y_true, scores)
    auc = roc_auc_score(y_true, scores)

    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(fpr, tpr, lw=2, label=f"AUC = {auc:.3f}")
    ax.axvline(x=0.05, color="grey", linestyle="--", alpha=0.5, label="FPR = 5%")

    # Mark operating point
    op_idx = np.argmin(np.abs(thresholds - CLASSIFY_THRESHOLD))
    ax.scatter(fpr[op_idx], tpr[op_idx], s=80, zorder=5,
               color="red", label=f"z≥{CLASSIFY_THRESHOLD} threshold")

    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("RecChain AI Auditor — ROC Curve")
    ax.legend(loc="lower right")
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  Saved → {out_path.name}")


def plot_zscore_distribution(readings, params, y_true, out_path: Path):
    """Histogram of |z-scores| coloured by ground truth."""
    _, scores = zscore_classifier(readings, params)

    fig, ax = plt.subplots(figsize=(7, 4))
    bins = np.linspace(0, 10, 50)
    ax.hist(scores[y_true == 0], bins=bins, alpha=0.6, label="Normal", color="steelblue")
    ax.hist(scores[y_true == 1], bins=bins, alpha=0.6, label="Anomaly", color="tomato")
    ax.axvline(CLASSIFY_THRESHOLD, color="orange", linestyle="--",
               label=f"Threshold |z|={CLASSIFY_THRESHOLD}")
    ax.axvline(THRESHOLD_FLAGGED, color="red", linestyle="--",
               label=f"Flagged |z|={THRESHOLD_FLAGGED}")
    ax.set_xlabel("|z-score|")
    ax.set_ylabel("Count")
    ax.set_title("RecChain AI Auditor — Z-Score Distribution")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  Saved → {out_path.name}")


def run_evaluation(n: int, anomaly_rate: float, seed: int):
    params = load_params()

    print(f"\nGenerating {n} readings ({anomaly_rate*100:.0f}% anomalies, seed={seed})…")
    readings, y_true = generate_dataset(params, n, anomaly_rate, seed)
    y_pred, scores   = zscore_classifier(readings, params)

    # ── Metrics ──────────────────────────────────────────────────────────────
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    prec, rec, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, pos_label=1, average="binary", zero_division=0
    )
    auc  = roc_auc_score(y_true, scores)
    acc  = (tp + tn) / n

    report_str = classification_report(
        y_true, y_pred,
        target_names=["Normal", "Anomaly"],
        digits=4,
    )

    # ── Print ─────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  RecChain AI Auditor — Evaluation Results")
    print("=" * 60)
    print(f"  Dataset  : n={n}, anomaly_rate={anomaly_rate*100:.0f}%, seed={seed}")
    print(f"  Threshold: |z| ≥ {CLASSIFY_THRESHOLD} (suspicious / flagged ≥ {THRESHOLD_FLAGGED})")
    print()
    print(f"  Confusion Matrix:")
    print(f"    TN={tn}  FP={fp}")
    print(f"    FN={fn}  TP={tp}")
    print()
    print(f"  Accuracy  : {acc:.4f}")
    print(f"  Precision : {prec:.4f}")
    print(f"  Recall    : {rec:.4f}")
    print(f"  F1 Score  : {f1:.4f}")
    print(f"  ROC-AUC   : {auc:.4f}")
    print()
    print(report_str)

    # ── Anomaly type breakdown ────────────────────────────────────────────────
    anom_types = [r["anomaly_type"] for r in readings]
    type_results = {}
    for i, r in enumerate(readings):
        if r["true_anomaly"] == 1:
            at = r["anomaly_type"]
            if at not in type_results:
                type_results[at] = {"tp": 0, "fn": 0}
            if y_pred[i] == 1:
                type_results[at]["tp"] += 1
            else:
                type_results[at]["fn"] += 1

    print("  Detection rate by anomaly type:")
    for at, v in sorted(type_results.items()):
        total = v["tp"] + v["fn"]
        rate  = v["tp"] / total if total else 0
        print(f"    {at:<22} {v['tp']}/{total} ({rate*100:.1f}%)")

    # ── Save JSON report ─────────────────────────────────────────────────────
    report = {
        "config": {
            "n": n, "anomaly_rate": anomaly_rate, "seed": seed,
            "classify_threshold": CLASSIFY_THRESHOLD,
            "flagged_threshold": THRESHOLD_FLAGGED,
        },
        "confusion_matrix": {"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)},
        "metrics": {
            "accuracy":  round(acc,  4),
            "precision": round(prec, 4),
            "recall":    round(rec,  4),
            "f1":        round(f1,   4),
            "roc_auc":   round(auc,  4),
        },
        "anomaly_type_breakdown": {
            at: {
                "detected": v["tp"],
                "total":    v["tp"] + v["fn"],
                "detection_rate": round(v["tp"] / (v["tp"] + v["fn"]), 4) if (v["tp"] + v["fn"]) else 0,
            }
            for at, v in type_results.items()
        },
    }

    json_path = RESULTS_DIR / "evaluation_report.json"
    with open(json_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  Saved → {json_path.name}")

    txt_path = RESULTS_DIR / "evaluation_report.txt"
    with open(txt_path, "w") as f:
        f.write("RecChain AI Auditor — Evaluation Report\n")
        f.write("=" * 60 + "\n")
        f.write(f"n={n}, anomaly_rate={anomaly_rate*100:.0f}%, seed={seed}\n")
        f.write(f"threshold |z| >= {CLASSIFY_THRESHOLD}\n\n")
        f.write(f"Accuracy : {acc:.4f}\n")
        f.write(f"Precision: {prec:.4f}\n")
        f.write(f"Recall   : {rec:.4f}\n")
        f.write(f"F1       : {f1:.4f}\n")
        f.write(f"ROC-AUC  : {auc:.4f}\n\n")
        f.write(report_str)
    print(f"  Saved → {txt_path.name}")

    # ── Plots ─────────────────────────────────────────────────────────────────
    print("\nGenerating plots…")
    plot_confusion_matrix(y_true, y_pred,  RESULTS_DIR / "confusion_matrix.png")
    plot_roc(y_true, scores,               RESULTS_DIR / "roc_curve.png")
    plot_zscore_distribution(readings, params, y_true, RESULTS_DIR / "zscore_distribution.png")

    print("\nAll results written to evaluation/results/")
    return report


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Evaluate RecChain AI Auditor")
    parser.add_argument("--n",            type=int,   default=1000)
    parser.add_argument("--anomaly_rate", type=float, default=0.10)
    parser.add_argument("--seed",         type=int,   default=42)
    args = parser.parse_args()

    run_evaluation(args.n, args.anomaly_rate, args.seed)


if __name__ == "__main__":
    main()
