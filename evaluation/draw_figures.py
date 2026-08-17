"""
draw_figures.py
===============
Redraws Fig 1 (Architecture), Fig 2 (Oracle Sequence), Fig 7 (Threat Model)
from scratch using matplotlib — clean, publication-quality, unicode-safe.
Output: evaluation/results/figures/fig1_architecture.png
        evaluation/results/figures/fig2_oracle_sequence.png
        evaluation/results/figures/fig7_threat_model.png
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from matplotlib.lines import Line2D
import numpy as np
from pathlib import Path

OUT = Path(__file__).parent / "results" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

# ── Shared style constants ────────────────────────────────────────────────────
FONT_TITLE  = dict(fontsize=13, fontweight='bold', color='#111111', family='DejaVu Sans')
FONT_BODY   = dict(fontsize=10, color='#333333', family='DejaVu Sans')
FONT_SMALL  = dict(fontsize=9,  color='#444444', family='DejaVu Sans')
FONT_LABEL  = dict(fontsize=9,  color='#222222', family='DejaVu Sans', style='italic')
FONT_MONO   = dict(fontsize=8.5, color='#333333', family='DejaVu Sans Mono')
ARROW_STYLE = dict(arrowstyle='->', color='#333333', lw=1.5)
DARROW_STYLE= dict(arrowstyle='->', color='#555555', lw=1.2, linestyle='dashed')

# Layer colours: light fill + medium border
C = {
    'layer4': ('#E8F5EF', '#2E8B57'),   # teal (React frontend)
    'layer3': ('#EEF0FA', '#4A43A0'),   # purple (Backend API)
    'layer2': ('#FFF4E5', '#C07820'),   # amber (Smart Contract)
    'chainlink': ('#FEF0EB', '#C05030'), # red-orange (Chainlink DON)
    'layer1': ('#F5F5F5', '#666666'),   # gray (IoT Meters)
    'issuer': ('#EEF0FA', '#4A43A0'),
    'smart': ('#FFF4E5', '#C07820'),
    'don': ('#FEF0EB', '#C05030'),
    'iot': ('#E8F5EF', '#2E8B57'),
    'threat': ('#FFF0F0', '#CC3333'),
    'chain': ('#E8F0FF', '#3355CC'),
    'back': ('#F0E8FF', '#7733CC'),
    'react': ('#FFE8F5', '#CC3388'),
}


# ══════════════════════════════════════════════════════════════════════════════
# FIG 1 — ARCHITECTURE (layer diagram)
# ══════════════════════════════════════════════════════════════════════════════

def draw_box(ax, x, y, w, h, fill, edge, text1, text2=None, radius=0.03):
    box = FancyBboxPatch((x, y), w, h,
                         boxstyle=f"round,pad=0,rounding_size={radius}",
                         facecolor=fill, edgecolor=edge, linewidth=1.5, zorder=2)
    ax.add_patch(box)
    ty = y + h/2 + (0.025 if text2 else 0)
    ax.text(x + w/2, ty, text1, ha='center', va='center',
            fontsize=12, fontweight='bold', color='#111111', zorder=3)
    if text2:
        ax.text(x + w/2, y + h/2 - 0.045, text2,
                ha='center', va='center', fontsize=9, color='#555555', zorder=3)

def draw_arrow_v(ax, x, y0, y1, label=None, dashed=False):
    ls = (0, (4, 4)) if dashed else 'solid'
    ax.annotate('', xy=(x, y1), xytext=(x, y0),
                arrowprops=dict(arrowstyle='->', color='#555555',
                                lw=1.4, linestyle=ls),
                zorder=4)
    if label:
        ax.text(x + 0.03, (y0 + y1)/2, label,
                ha='left', va='center', fontsize=9, color='#555555',
                style='italic', zorder=5)

def fig1():
    fig, ax = plt.subplots(figsize=(9, 8))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # Boxes: (x, y, w, h, fill, edge, title, subtitle)
    layers = [
        (0.05, 0.80, 0.90, 0.13,
         C['layer4'][0], C['layer4'][1],
         'Layer 4 — React Frontend',
         'Portfolio · Marketplace · AI Auditor · Carbon Passport · Public Verification'),
        (0.05, 0.58, 0.90, 0.14,
         C['layer3'][0], C['layer3'][1],
         'Layer 3 — Express.js Backend API',
         '12 endpoints · Anomaly Detection Module · Carbon Passport PDF · ethers.js read-only provider'),
        (0.05, 0.36, 0.90, 0.13,
         C['layer2'][0], C['layer2'][1],
         'Layer 2 — RecDapp.sol (EVM Smart Contract)',
         'ERC-1155 · AccessControl · ReentrancyGuard · FunctionsClient (Chainlink)'),
        (0.05, 0.06, 0.90, 0.13,
         C['layer1'][0], C['layer1'][1],
         'Layer 1 — IoT Smart Meters',
         'METER_GR_001...005 · Hourly kWh readings · REST API'),
    ]
    for (x, y, w, h, fill, edge, t1, t2) in layers:
        draw_box(ax, x, y, w, h, fill, edge, t1, t2)

    # Chainlink DON box (between L2 and L1)
    draw_box(ax, 0.28, 0.225, 0.44, 0.11,
             C['chainlink'][0], C['chainlink'][1],
             'Chainlink DON',
             'Threshold consensus · JS execution · fulfillRequest()')

    # Arrows
    # L4 → L3 (REST)
    draw_arrow_v(ax, 0.50, 0.800, 0.720, 'REST /api/*')
    draw_arrow_v(ax, 0.46, 0.720, 0.800)  # bidirectional (slight offset)

    # MetaMask direct arrow (L4 → L2), dashed
    ax.annotate('', xy=(0.72, 0.490), xytext=(0.72, 0.800),
                arrowprops=dict(arrowstyle='->', color='#888888',
                                lw=1.2, linestyle=(0, (4, 4))),
                zorder=4)
    ax.text(0.74, 0.645, 'MetaMask\n(direct write)',
            ha='left', va='center', fontsize=8.5, color='#777777',
            style='italic', zorder=5)

    # L3 → L2 (ethers.js)
    draw_arrow_v(ax, 0.30, 0.580, 0.490, 'ethers.js')
    draw_arrow_v(ax, 0.26, 0.490, 0.580)

    # L2 → Chainlink DON
    draw_arrow_v(ax, 0.40, 0.360, 0.335)
    draw_arrow_v(ax, 0.60, 0.335, 0.360)

    # Chainlink DON → L1 (IoT REST fetch)
    draw_arrow_v(ax, 0.50, 0.225, 0.190, 'IoT REST fetch')
    draw_arrow_v(ax, 0.46, 0.190, 0.225)

    ax.set_title('Figure 1. RecChain four-layer architecture.\n'
                 'Dashed arrow = direct MetaMask wallet interaction (no API required).',
                 fontsize=10, color='#333333', pad=6)

    plt.tight_layout()
    fig.savefig(OUT / 'fig1_architecture.png', dpi=200,
                bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('Fig 1 saved.')

fig1()


# ══════════════════════════════════════════════════════════════════════════════
# FIG 2 — ORACLE SEQUENCE DIAGRAM
# ══════════════════════════════════════════════════════════════════════════════

def fig2():
    fig, ax = plt.subplots(figsize=(15, 9))
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 9)
    ax.axis('off')
    fig.patch.set_facecolor('white')

    # Wider spacing so long labels don't overlap with participant boxes
    XC = {'issuer': 1.8, 'smart': 6.0, 'don': 10.2, 'iot': 13.6}
    P_w = 2.2   # participant box width
    P_h = 0.60  # participant box height
    TOP = 8.5   # y-centre of participant boxes
    BOT = 0.3   # bottom of lifelines

    part_labels = {
        'issuer': 'Issuer',
        'smart':  'RecDapp.sol',
        'don':    'Chainlink DON',
        'iot':    'IoT Meter API',
    }
    part_colors = {
        'issuer': C['issuer'],
        'smart':  C['smart'],
        'don':    C['don'],
        'iot':    C['iot'],
    }

    # Draw participant boxes
    for key, xc in XC.items():
        fill, edge = part_colors[key]
        box = FancyBboxPatch((xc - P_w/2, TOP - P_h/2), P_w, P_h,
                             boxstyle="round,pad=0,rounding_size=0.08",
                             facecolor=fill, edgecolor=edge, linewidth=2.2, zorder=3)
        ax.add_patch(box)
        ax.text(xc, TOP, part_labels[key],
                ha='center', va='center',
                fontsize=12, fontweight='bold', color='#111111', zorder=4)

    # Lifelines
    for key, xc in XC.items():
        _, edge = part_colors[key]
        ax.plot([xc, xc], [TOP - P_h/2, BOT],
                color=edge, lw=1.0, ls=(0, (6, 4)), alpha=0.5, zorder=1)

    def seq_arrow(x0, y, x1, label, dashed=False):
        """Horizontal sequence arrow with label ABOVE."""
        ls = (0, (5, 4)) if dashed else 'solid'
        clr = '#555555' if dashed else '#222222'
        ax.annotate('', xy=(x1, y), xytext=(x0, y),
                    arrowprops=dict(arrowstyle='->', color=clr,
                                    lw=1.6, linestyle=ls),
                    zorder=5)
        ax.text((x0 + x1)/2, y + 0.22, label,
                ha='center', va='bottom',
                fontsize=9.5, color='#111111', zorder=6,
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white',
                          edgecolor='none', alpha=0.92))

    def act_bar(xc, y_start, y_end, color):
        """Vertical activation bar on a lifeline."""
        ax.add_patch(FancyBboxPatch((xc - 0.10, y_end), 0.20, y_start - y_end,
                                    boxstyle="square,pad=0",
                                    facecolor=color, edgecolor='#888888',
                                    linewidth=0.9, zorder=2))

    def inline_note(x, y, text, bg='#FFFBE6', border='#CCAA00'):
        """Note box (internal logic) attached to a lifeline."""
        ax.text(x, y, text, ha='left', va='center',
                fontsize=9, color='#222222', zorder=6,
                bbox=dict(boxstyle='round,pad=0.3', facecolor=bg,
                          edgecolor=border, alpha=0.95, linewidth=1.0))

    # ── Activation bars span step durations ──────────────────────────────────
    act_bar(XC['issuer'], 7.90, 7.50, '#D0D0F0')   # step 1
    act_bar(XC['smart'],  7.30, 6.70, '#F0DDB0')   # steps 2–3
    act_bar(XC['don'],    6.50, 5.20, '#F0C8B0')   # steps 3–4
    act_bar(XC['smart'],  4.80, 3.30, '#F0DDB0')   # step 5–6
    act_bar(XC['issuer'], 3.00, 2.60, '#D0D0F0')   # emit

    # ── Messages ──────────────────────────────────────────────────────────────
    # 1. requestAutoIssuance
    seq_arrow(XC['issuer'] + P_w/2, 7.70,
              XC['smart']  - P_w/2,
              'requestAutoIssuance(producer, source, meterId)')

    # 2. Chainlink Functions request
    seq_arrow(XC['smart'] + P_w/2, 6.90,
              XC['don']   - P_w/2,
              'Chainlink Functions request + meterId arg')

    # 3a. GET /meter/{id}/reading
    seq_arrow(XC['don'] + P_w/2, 6.30,
              XC['iot']  - P_w/2,
              'GET /meter/{id}/reading')

    # 3b. { kWh, mean, std } — dashed return
    seq_arrow(XC['iot'] - P_w/2, 5.70,
              XC['don']  + P_w/2,
              '{ kWh, mean, std }', dashed=True)

    # 4. Anomaly gate note (internal, at Chainlink DON lifeline)
    inline_note(XC['don'] - P_w/2 + 0.12, 5.10,
                '3σ anomaly gate:  |z| > 3  →  abort\n'
                'z OK  →  ABI-encode kWh as uint256')

    # 5. fulfillRequest (DON → RecDapp)
    seq_arrow(XC['don']   - P_w/2, 4.55,
              XC['smart'] + P_w/2,
              'fulfillRequest(requestId, kWh_encoded, err="")')

    # 6. Mint logic note (internal, at RecDapp lifeline)
    inline_note(XC['smart'] - P_w/2 + 0.12, 3.90,
                'kWh ≥ 1000  →  _issueRec()\n'
                'dataHash = "oracle://METER_GR_001"')

    # 7. emit RecIssued (dashed, RecDapp → Issuer)
    seq_arrow(XC['smart']  - P_w/2, 3.15,
              XC['issuer'] + P_w/2,
              'emit RecIssued(tokenId, producer, kWh)', dashed=True)

    # ── Error path box (bottom right, under Chainlink/IoT area) ──────────────
    err_box = FancyBboxPatch((XC['don'] - P_w/2 - 0.1, 0.4),
                             P_w + 2.8, 0.85,
                             boxstyle="round,pad=0.08",
                             facecolor='#FFF0F0', edgecolor='#CC4444',
                             linewidth=1.0, ls=(0, (4, 3)), zorder=2)
    ax.add_patch(err_box)
    ax.text(XC['don'] + 0.8, 0.82,
            'Alt path — if err ≠ "" or kWh < 1000:',
            ha='center', va='center',
            fontsize=9, fontweight='bold', color='#882222', zorder=6)
    ax.text(XC['don'] + 0.8, 0.55,
            'emit OracleFulfillmentError  —  no REC minted',
            ha='center', va='center',
            fontsize=9, color='#882222', zorder=6)

    # Step number annotations on the left margin
    steps = [
        (7.70, '①'), (6.90, '②'), (6.30, '③'),
        (5.70, '④'), (4.55, '⑤'), (3.15, '⑥'),
    ]
    for y_s, num in steps:
        ax.text(0.15, y_s, num, ha='center', va='center',
                fontsize=10, color='#888888', zorder=5)

    ax.set_title('Figure 2. Oracle-based certificate issuance sequence.\n'
                 'Solid arrows = calls/requests;  dashed arrows = responses/events.',
                 fontsize=10, color='#333333', pad=8)

    plt.tight_layout()
    fig.savefig(OUT / 'fig2_oracle_sequence.png', dpi=200,
                bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('Fig 2 saved.')

fig2()


# ══════════════════════════════════════════════════════════════════════════════
# FIG 7 — THREAT MODEL
# ══════════════════════════════════════════════════════════════════════════════

def fig7():
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis('off')
    fig.patch.set_facecolor('white')

    def comp_box(x, y, w, h, fill, edge, title, subtitle=None):
        box = FancyBboxPatch((x, y), w, h,
                             boxstyle="round,pad=0,rounding_size=0.12",
                             facecolor=fill, edgecolor=edge,
                             linewidth=2.2, zorder=3)
        ax.add_patch(box)
        cy = y + h/2 + (0.18 if subtitle else 0)
        ax.text(x + w/2, cy, title, ha='center', va='center',
                fontsize=12, fontweight='bold', color='#111111', zorder=4)
        if subtitle:
            ax.text(x + w/2, y + h/2 - 0.22, subtitle,
                    ha='center', va='center',
                    fontsize=9.5, color='#444444', zorder=4)

    def flow_arrow(x0, y0, x1, y1, label='', color='#1144BB'):
        ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                    arrowprops=dict(arrowstyle='->', color=color,
                                    lw=2.0),
                    zorder=5)
        if label:
            mx, my = (x0+x1)/2, (y0+y1)/2
            ax.text(mx, my + 0.18, label, ha='center', va='bottom',
                    fontsize=9, color=color, style='italic', zorder=6,
                    bbox=dict(boxstyle='round,pad=0.15', facecolor='white',
                              edgecolor='none', alpha=0.9))

    def threat_arrow(x0, y0, x1, y1, tag, tag_at='mid'):
        ax.annotate('', xy=(x1, y1), xytext=(x0, y0),
                    arrowprops=dict(arrowstyle='->', color='#CC1111',
                                    lw=1.8, linestyle=(0, (4, 3))),
                    zorder=5)
        if tag_at == 'mid':
            tx, ty = (x0+x1)/2, (y0+y1)/2
        elif tag_at == 'start':
            tx, ty = x0 + 0.15, y0 - 0.25
        else:
            tx, ty = x1 - 0.15, y1 + 0.25
        ax.text(tx, ty, tag, ha='center', va='center',
                fontsize=9.5, fontweight='bold', color='white', zorder=7,
                bbox=dict(boxstyle='round,pad=0.25', facecolor='#CC1111',
                          edgecolor='none'))

    def side_note(x, y, text, bg='#FFF8E8', border='#AA8800'):
        ax.text(x, y, text, ha='center', va='center',
                fontsize=8.5, color='#333300', style='italic', zorder=6,
                bbox=dict(boxstyle='round,pad=0.25', facecolor=bg,
                          edgecolor=border, alpha=0.92, linewidth=0.9))

    # ── Component positions ───────────────────────────────────────────────────
    #   Threat Actor: top-left
    #   IoT Meters:   left-mid
    #   Chainlink DON: top-center
    #   RecDapp.sol:  center
    #   Backend API:  bottom-center
    #   React Frontend: right

    # ── Component layout: arranged to avoid arrow crossings ──────────────────
    # (x, y, w, h)
    B = {
        'actor':    (0.3,  5.8, 2.2, 1.4),   # Threat Actor   — top-left
        'iot':      (0.3,  2.8, 2.2, 1.4),   # IoT Meters     — left-centre
        'don':      (5.0,  5.8, 2.6, 1.4),   # Chainlink DON  — centre-top
        'smart':    (7.0,  3.4, 2.6, 1.8),   # RecDapp.sol    — taller box, more room
        'backend':  (4.8,  0.5, 2.8, 1.4),   # Backend API    — lower, wider
        'react':    (10.2, 3.4, 1.8, 1.8),   # React          — far right
    }

    # Helper shortcuts
    def cx(k): return B[k][0] + B[k][2]/2
    def cy(k): return B[k][1] + B[k][3]/2
    def top(k): return B[k][1] + B[k][3]
    def bot(k): return B[k][1]
    def lft(k): return B[k][0]
    def rgt(k): return B[k][0] + B[k][2]

    comp_box(*B['actor'],  '#FFE8E8', '#CC2222', 'Threat Actor')
    comp_box(*B['iot'],    C['iot'][0],  C['iot'][1],  'IoT Smart Meters',
             'METER_GR_001...005')
    comp_box(*B['don'],    C['don'][0],  C['don'][1],  'Chainlink DON',
             'Threshold consensus (BFT)')
    comp_box(*B['smart'],  C['smart'][0],C['smart'][1],'RecDapp.sol',
             'Smart Contract')
    comp_box(*B['backend'],C['back'][0], C['back'][1], 'Backend API + Auditor')
    comp_box(*B['react'],  C['react'][0],C['react'][1],'React Frontend')

    # ── Normal data flows ─────────────────────────────────────────────────────
    # IoT Meters → Chainlink DON  (horizontal right — no crossing)
    flow_arrow(rgt('iot'), cy('iot'), lft('don'), cy('don'),
               'IoT data', '#1144BB')

    # Chainlink DON → RecDapp.sol  (diagonal down-right)
    flow_arrow(cx('don'), bot('don'), cx('smart'), top('smart'),
               '', '#1144BB')
    # fulfillRequest label placed to the right of the arrow, not on the midpoint
    ax.text(cx('don') + 0.5, (bot('don') + top('smart'))/2 - 0.1,
            'fulfillRequest()', ha='left', va='center',
            fontsize=8.5, color='#1144BB', style='italic', zorder=6,
            bbox=dict(boxstyle='round,pad=0.15', facecolor='white',
                      edgecolor='none', alpha=0.9))

    # RecDapp.sol → Backend API  (down-left diagonal)
    flow_arrow(cx('smart'), bot('smart'), cx('backend'), top('backend'),
               'reads chain', '#6622BB')

    # Backend API → React  (horizontal right)
    flow_arrow(rgt('backend'), cy('backend'), lft('react'), cy('react')-0.35,
               'API response', '#6622BB')

    # RecDapp.sol → React  (horizontal right)
    flow_arrow(rgt('smart'), cy('smart'), lft('react'), cy('react'),
               'contract events', '#1144BB')

    # ── Threat arrows ─────────────────────────────────────────────────────────
    # T1: Spoof IoT endpoint  (Threat Actor → IoT Meters, straight down left side)
    threat_arrow(cx('actor'), bot('actor'), cx('iot'), top('iot'), 'T1')

    # T2: DON manipulation  (Threat Actor → Chainlink DON, horizontal right)
    threat_arrow(rgt('actor'), cy('actor'), lft('don'), cy('don'), 'T2')

    # T3: API layer outage  — arc below diagram avoids crossing IoT→DON arrow
    ax.annotate('', xy=(cx('backend'), top('backend')),
                xytext=(rgt('actor'), bot('actor')),
                arrowprops=dict(arrowstyle='->', color='#CC1111',
                                lw=1.8, linestyle=(0, (4, 3)),
                                connectionstyle='arc3,rad=0.45'),
                zorder=5)
    ax.text(2.6, 1.35, 'T3', ha='center', va='center',
            fontsize=9.5, fontweight='bold', color='white', zorder=7,
            bbox=dict(boxstyle='round,pad=0.25', facecolor='#CC1111',
                      edgecolor='none'))

    # T4: Reentrancy — annotated badge pointing INTO RecDapp.sol from the left
    ax.annotate('T4: Reentrancy\n(mitigated by ReentrancyGuard)',
                xy=(lft('smart') + 0.05, cy('smart') - 0.2),
                xytext=(lft('smart') - 1.6, cy('smart') - 0.2),
                fontsize=8, color='white', va='center', ha='left', zorder=7,
                bbox=dict(boxstyle='round,pad=0.28', facecolor='#AA1111',
                          edgecolor='none'),
                arrowprops=dict(arrowstyle='->', color='#AA1111', lw=1.2))

    # AccessControl note removed — detail belongs in paper text, not the figure

    # ── Threat Vectors Legend ─────────────────────────────────────────────────
    lx, ly, lw, lh = 0.15, 0.2, 3.0, 2.5
    legend_box = FancyBboxPatch((lx, ly), lw, lh,
                                boxstyle="round,pad=0.05",
                                facecolor='#FFF5F5', edgecolor='#CC3333',
                                linewidth=1.2, ls=(0, (4, 3)), zorder=2)
    ax.add_patch(legend_box)
    ax.text(lx+lw/2, ly+lh-0.28, 'Threat Vectors',
            ha='center', va='center',
            fontsize=10.5, fontweight='bold', color='#CC2222', zorder=4)
    threats = [
        ('T1', 'Spoof IoT endpoint'),
        ('T2', 'DON data manipulation'),
        ('T3', 'API layer outage / DDoS'),
        ('T4', 'Reentrancy attack (mitigated)'),
    ]
    for i, (tag, desc) in enumerate(threats):
        y_t = ly + lh - 0.70 - i*0.46
        ax.text(lx+0.25, y_t, tag, ha='left', va='center',
                fontsize=9, fontweight='bold', color='white', zorder=5,
                bbox=dict(boxstyle='round,pad=0.2', facecolor='#CC2222',
                          edgecolor='none'))
        ax.text(lx+0.75, y_t, desc, ha='left', va='center',
                fontsize=9, color='#441111', zorder=5)

    ax.set_title('Figure 7. RecChain threat model.\n'
                 'Red dashed arrows = attack vectors;  blue/purple = normal data flows.',
                 fontsize=10, color='#333333', pad=8)

    plt.tight_layout()
    fig.savefig(OUT / 'fig7_threat_model.png', dpi=200,
                bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('Fig 7 saved.')

fig7()

print(f'\nAll 3 figures saved to: {OUT}')
