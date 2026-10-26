# RecChain revised manuscript

Sole author: Panagiotis Vionis. This is the 26 October 2026 research revision.
The manuscript separates earlier synthetic/national experiments from the new
three-site PVDAQ study and revised workflow contracts. It makes no claim of a
new detection algorithm, live CRE operation or recognised-registry conformity.

From this directory, build twice:

```sh
pdflatex -interaction=nonstopmode -halt-on-error RecChain.tex
pdflatex -interaction=nonstopmode -halt-on-error RecChain.tex
```

`generated/` contains tables and the energy figure produced directly from
`evaluation_journal/results`. `analysis/verify_revision.py` reproduces the
corrected aligned-ranks test and earlier chronological national-series results.
The raw national extract and archived results are retained there, in their
original units and with their upstream terms. The new PV scripts, processed
data, protocol, checksums and all replication results are in `evaluation_journal/`.
See that directory's README for complete commands and interpretation.

The PDF has been rendered and inspected. The source package preserves the main
LaTeX source, generated material and earlier analysis; the complete current
application and new experiment are in the research branch, identified by the
commit in the accompanying `REVISION.txt` when packaged.
