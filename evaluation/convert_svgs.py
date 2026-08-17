"""
convert_svgs.py — Convert all RecChain SVG figures to PNG at 200 DPI.
Output goes to evaluation/results/figures/ for easy Word insertion.
"""
import cairosvg
from pathlib import Path

SVG_DIR    = Path("/home/lysos/Desktop/Panagiotis/papers/RecChain")
RESULTS    = Path(__file__).parent / "results"
FIGURES    = RESULTS / "figures"
FIGURES.mkdir(exist_ok=True)

# Map: SVG filename → output PNG filename + paper figure number
SVGS = [
    ("recchain_architecture_fig1.svg", "fig1_architecture.png"),
    ("recchain_oracle_sequence_fig2.svg", "fig2_oracle_sequence.png"),
    ("sensitivity_chart.svg", None),   # will be replaced by our new PNG below
    ("threat_model.svg", "fig7_threat_model.png"),
]

for svg_name, png_name in SVGS:
    if png_name is None:
        continue
    src = SVG_DIR / svg_name
    dst = FIGURES / png_name
    print(f"Converting {svg_name} → {png_name} ...", end=" ")
    cairosvg.svg2png(url=str(src), write_to=str(dst), dpi=200)
    print("OK")

# Copy the evaluation PNGs (already high quality at 150 DPI)
import shutil

eval_pngs = [
    ("confusion_matrix.png",  "fig3_confusion_matrix.png"),
    ("roc_curve.png",         "fig4_roc_curve.png"),
    ("zscore_distribution.png", "fig5_zscore_distribution.png"),
    ("sensitivity_chart.png", "fig6_sensitivity_chart.png"),
]
for src_name, dst_name in eval_pngs:
    src = RESULTS / src_name
    dst = FIGURES / dst_name
    if src.exists():
        shutil.copy2(src, dst)
        print(f"Copied {src_name} → {dst_name}")
    else:
        print(f"MISSING: {src_name}")

print(f"\nAll figures ready in: {FIGURES}")
print("\nFigure index:")
for f in sorted(FIGURES.iterdir()):
    size_kb = f.stat().st_size // 1024
    print(f"  {f.name:40s} {size_kb} KB")
