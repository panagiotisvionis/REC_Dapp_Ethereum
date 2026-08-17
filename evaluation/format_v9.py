"""
format_v9.py
============
Δημιουργεί RecChain_manuscript_v9_formatted.docx από v8 με:

1. Headings, τίτλους, metadata → μαύρο χρώμα (000000)
2. Table headers → λευκό φόντο, μαύρα bold γράμματα
3. Εξισώσεις/μαθηματικά → italic + centered
4. Section restructuring: ενοποίηση single-paragraph subsections
   - Sec 2: 5 × 1-para → 3 μεγαλύτερα subsections
   - Sec 4: αφαίρεση 4.1, 4.2 headings (μεργκ στο body)
   - Sec 5: αφαίρεση 5.1, 5.2 headings
   - Sec 6: αφαίρεση 6.2 heading
   - Sec 8: αφαίρεση 8.1, 8.2 headings
   - Sec 9: αφαίρεση 9.1, 9.2 headings
   - Sec 10: 4 × 1-para → 2 × 2-para subsections
"""

from pathlib import Path
from docx import Document
from docx.shared import RGBColor, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from lxml import etree
import copy, re

SRC = Path("/home/lysos/Desktop/Panagiotis/papers/RecChain/RecChain_manuscript_v8_complete.docx")
OUT = Path("/home/lysos/Desktop/Panagiotis/papers/RecChain/RecChain_manuscript_v9_formatted.docx")

doc = Document(str(SRC))

# ── Helper: set cell background colour ───────────────────────────────────────
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

def set_cell_bg(cell, hex_color):
    tc    = cell._tc
    tcPr  = tc.find(f'{{{W}}}tcPr')
    if tcPr is None:
        tcPr = etree.SubElement(tc, f'{{{W}}}tcPr')
        tc.insert(0, tcPr)
    shd = tcPr.find(f'{{{W}}}shd')
    if shd is None:
        shd = etree.SubElement(tcPr, f'{{{W}}}shd')
    shd.set(f'{{{W}}}val',   'clear')
    shd.set(f'{{{W}}}color', 'auto')
    shd.set(f'{{{W}}}fill',  hex_color)

def set_run_color(run, hex_color):
    run.font.color.rgb = RGBColor(
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16),
    )

def rename_heading(para, new_text):
    """Rename a heading paragraph keeping its style."""
    para.clear()
    para.add_run(new_text)

def remove_para(para):
    el = para._element
    el.getparent().remove(el)

# ════════════════════════════════════════════════════════════════════════════
# 1. HEADING COLOURS → BLACK
# ════════════════════════════════════════════════════════════════════════════
heading_styles = {'Heading 1', 'Heading 2', 'Heading 3', 'Title'}
meta_indices   = {3, 4, 5}   # author / affiliation / target-journal lines

for i, p in enumerate(doc.paragraphs):
    style_name = p.style.name if p.style else ''
    if style_name in heading_styles or i in meta_indices:
        for run in p.runs:
            set_run_color(run, '000000')
            # Also clear any theme colour
            rPr = run._r.get_or_add_rPr()
            color_el = rPr.find(f'{{{W}}}color')
            if color_el is not None:
                color_el.set(f'{{{W}}}val', '000000')
                # Remove themeColor attribute if present
                theme_attr = f'{{{W}}}themeColor'
                if theme_attr in color_el.attrib:
                    del color_el.attrib[theme_attr]

print("1. Heading colours → black ✓")

# ════════════════════════════════════════════════════════════════════════════
# 2. TABLE HEADERS → WHITE BACKGROUND, BLACK BOLD TEXT
# ════════════════════════════════════════════════════════════════════════════
for table in doc.tables:
    header_row = table.rows[0]
    for cell in header_row.cells:
        set_cell_bg(cell, 'FFFFFF')
        for para in cell.paragraphs:
            para.clear()
            # Rebuild with bold black text
            text = cell.text.strip()
            run  = para.add_run(text)
            run.bold = True
            set_run_color(run, '000000')

print("2. Table headers → white bg, black bold ✓")

# ════════════════════════════════════════════════════════════════════════════
# 3. MATHEMATICAL EQUATIONS → ITALIC + CENTERED
# ════════════════════════════════════════════════════════════════════════════
MATH_PATTERNS = [
    r'^P_solar',        # production curve
    r'^δ\s*=',          # deviation
    r'^z\s*=',          # z-score formula
    r'^r\s*=',          # maintenance ratio
    r'^r\s*>',          # maintenance thresholds
    r'^\s*Critical:\s*\|δ\|',  # threshold description
]
MATH_RE = [re.compile(p) for p in MATH_PATTERNS]

for p in doc.paragraphs:
    t = p.text
    if any(rx.search(t) for rx in MATH_RE):
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # Make all runs italic
        for run in p.runs:
            run.italic = True
        # If paragraph has no runs yet (plain text), rebuild
        if not p.runs and t:
            p.clear()
            run = p.add_run(t)
            run.italic = True
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

print("3. Math equations → italic + centred ✓")

# ════════════════════════════════════════════════════════════════════════════
# 4. SECTION RESTRUCTURING
# ════════════════════════════════════════════════════════════════════════════

# Refresh paragraph list (indices may have shifted after table edits)
paras = doc.paragraphs

def find_heading(text_fragment):
    """Return first Heading paragraph whose text contains text_fragment."""
    for p in doc.paragraphs:
        style_name = p.style.name if p.style else ''
        if 'Heading' in style_name and text_fragment in p.text:
            return p
    return None

# ── 4a. Section 2: merge 2.1+2.2 → new 2.1;  2.3+2.4 → new 2.2;  2.5 → new 2.3
h21 = find_heading('2.1 ')
h22 = find_heading('2.2 ')
h23 = find_heading('2.3 ')
h24 = find_heading('2.4 ')
h25 = find_heading('2.5 ')

if h21: rename_heading(h21, '2.1 Blockchain Platforms and Token Standards for REC Management')
if h22: remove_para(h22)   # content absorbed into 2.1

if h23: rename_heading(h23, '2.2 Anomaly Detection and Oracle Verification in Energy IoT Systems')
if h24: remove_para(h24)   # content absorbed into 2.2

if h25: rename_heading(h25, '2.3 ESG Reporting Frameworks and Research Gap')

print("4a. Section 2 restructured (5 × 1-para → 3 subsections) ✓")

# ── 4b. Section 4: remove 4.1, 4.2 headings
for label in ['4.1 ', '4.2 ']:
    h = find_heading(label)
    if h: remove_para(h)
print("4b. Section 4 subsection headings removed ✓")

# ── 4c. Section 5: remove 5.1, 5.2 headings
for label in ['5.1 ', '5.2 ']:
    h = find_heading(label)
    if h: remove_para(h)
print("4c. Section 5 subsection headings removed ✓")

# ── 4d. Section 6: remove 6.2 heading
h = find_heading('6.2 ')
if h: remove_para(h)
print("4d. Section 6.2 heading removed ✓")

# ── 4e. Section 8: remove 8.1, 8.2 headings
for label in ['8.1 ', '8.2 ']:
    h = find_heading(label)
    if h: remove_para(h)
print("4e. Section 8 subsection headings removed ✓")

# ── 4f. Section 9: remove 9.1, 9.2 headings
for label in ['9.1 ', '9.2 ']:
    h = find_heading(label)
    if h: remove_para(h)
print("4f. Section 9 subsection headings removed ✓")

# ── 4g. Section 10: 4 × 1-para → 2 × 2-para
# Keep 10.1, remove 10.2 (its body flows under 10.1)
# Rename 10.3 → new 10.2, remove 10.4 (its body flows under new 10.2)
h101 = find_heading('10.1 ')
h102 = find_heading('10.2 ')
h103 = find_heading('10.3 ')
h104 = find_heading('10.4 ')

if h101: rename_heading(h101, '10.1 Evaluation Scope and Detection Methodology Limitations')
if h102: remove_para(h102)

if h103: rename_heading(h103, '10.2 Deployment Constraints and Future Research Directions')
if h104: remove_para(h104)

print("4g. Section 10 restructured (4 × 1-para → 2 × 2-para) ✓")

# ── 4h. Also rename 6.1 for clarity (it now absorbs 6.2 content)
h61 = find_heading('6.1 ')
if h61: rename_heading(h61, '6.1 Detection Methodology and Decision Logic')
print("4h. Section 6.1 renamed to absorb 6.2 ✓")

# ════════════════════════════════════════════════════════════════════════════
# 5. RE-APPLY BLACK COLOUR TO ALL HEADINGS (some may have lost it after clear())
# ════════════════════════════════════════════════════════════════════════════
for p in doc.paragraphs:
    style_name = p.style.name if p.style else ''
    if 'Heading' in style_name:
        for run in p.runs:
            set_run_color(run, '000000')

print("5. Re-applied black colour to all headings ✓")

# ════════════════════════════════════════════════════════════════════════════
# 6. SAVE
# ════════════════════════════════════════════════════════════════════════════
doc.save(str(OUT))
import os
size = os.path.getsize(OUT) // 1024
print(f"\n✓ Saved: {OUT.name}  ({size} KB)")

# ── Summary ───────────────────────────────────────────────────────────────
doc2 = Document(str(OUT))
headings = [(p.style.name, p.text) for p in doc2.paragraphs
            if p.style and 'Heading' in p.style.name]
print(f"\nFinal section structure ({len(headings)} headings):")
for style, text in headings:
    indent = '    ' if '2' in style else ''
    print(f"  {indent}{text}")
