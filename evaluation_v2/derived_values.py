"""
derived_values.py — numbers in the manuscript that are derived from archived
outputs rather than produced directly by an evaluation run.

  (1) Fig. 4: the largest 95% confidence half-width of precision, recall and
      F1 over the threshold sweep, read from results/honest_evaluation.json
      (mean +- 1.96 sd / sqrt(n), the interval used by evaluate_honest.py).
  (2) Sect. 6.6: batch-dependent issuance cost figures, read from the gas
      measurements in ../evaluation/results/gas_table.json (written by
      test/gas_benchmark.js). Gas price and ETH/USD are taken from the same
      file. The REC value of $3/MWh and the one-per-cent criterion are the
      illustrative assumptions stated in the manuscript.

Usage:
    python3 derived_values.py
"""
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
REC_VALUE_USD_PER_MWH = 3.0      # illustrative assumption stated in Sect. 6.6
SHARE = 0.01                     # "less than one per cent of certificate value"


def fig4_halfwidth():
    h = json.loads((HERE / "results" / "honest_evaluation.json").read_text())
    worst = 0.0
    for t, d in h["sweep"].items():
        for k in ("P", "R", "F1"):
            a = np.asarray(d[k], float)
            worst = max(worst, 1.96 * a.std(ddof=1) / np.sqrt(len(a)))
    return worst


def gas_figures():
    g = json.loads((HERE.parent / "evaluation" / "results" / "gas_table.json").read_text())
    gas = {e["function"]: e["gas_used"] for e in g["entries"]}
    gwei, eth = g["gas_price_gwei"], g["eth_usd"]
    usd = lambda gas_used, price=gwei: gas_used * price * 1e-9 * eth
    batches = {1: gas["issueRec"], 5: gas["issueRec (5 MWh)"], 100: gas["issueRec (100 MWh)"]}
    out = {"gas_price_gwei": gwei, "eth_usd": eth, "rec_value_usd_per_mwh": REC_VALUE_USD_PER_MWH}
    vals = list(batches.values())
    out["issue_gas_spread_pct"] = (max(vals) - min(vals)) / batches[1] * 100
    out["issue_gas_half_range"] = (max(vals) - min(vals)) / 2
    for mwh, gu in batches.items():
        per_mwh = usd(gu) / mwh
        out[f"batch_{mwh}MWh"] = {
            "gas": gu,
            "usd_per_mwh_at_ref_gas_price": per_mwh,
            "cost_over_value": per_mwh / REC_VALUE_USD_PER_MWH,
            "gwei_threshold_for_1pct": SHARE * REC_VALUE_USD_PER_MWH * mwh / (gu * 1e-9 * eth),
        }
    life = gas["issueRec"] + gas["listRec"] + gas["buyRec"] + gas["retireRec (full batch)"]
    out["lifecycle_gas"] = life
    out["cost_table"] = {str(p): {"issuance_usd": usd(batches[1], p), "lifecycle_usd": usd(life, p)}
                         for p in (30, 5, 1, 0.1, 0.05, 0.01)}
    return out


def main():
    hw = fig4_halfwidth()
    print(f"(1) Fig. 4: largest 95% CI half-width over the sweep = {hw:.4f}")
    g = gas_figures()
    print(f"(2) Issuance gas spread across 1/5/100 MWh: {g['issue_gas_spread_pct']:.2f}% "
          f"(+-{g['issue_gas_half_range']:.0f} gas)")
    for mwh in (1, 5, 100):
        b = g[f"batch_{mwh}MWh"]
        print(f"    {mwh:>3} MWh batch: ${b['usd_per_mwh_at_ref_gas_price']:.3f}/MWh at "
              f"{g['gas_price_gwei']} gwei = {b['cost_over_value']:.2f} x REC value; "
              f"1% threshold = {b['gwei_threshold_for_1pct']:.4f} gwei")
    print(f"    lifecycle gas = {g['lifecycle_gas']:,}")
    for p, c in g["cost_table"].items():
        print(f"    {p:>5} gwei: issuance ${c['issuance_usd']:.4f}  lifecycle ${c['lifecycle_usd']:.4f}")
    (HERE / "results" / "derived_values.json").write_text(json.dumps(
        {"fig4_max_ci_halfwidth": hw, "gas": g}, indent=2))
    print(f"  Written -> {HERE / 'results' / 'derived_values.json'}")


if __name__ == "__main__":
    main()
