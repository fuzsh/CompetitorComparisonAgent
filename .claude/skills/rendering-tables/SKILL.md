---
name: rendering-tables
description: Renders a verified Comparison into the interactive table payload and into Markdown, CSV, HTML, and PPTX exports with per-cell status badges and win/lose highlighting. Use as the final pipeline step and whenever the user requests an export.
---
# Rendering tables

## Steps (deterministic; `backend/export.py`, `frontend/components/ComparisonTable.tsx`)
1. Rows = fields, columns = Your Company (anchor) + competitors; each cell carries value, status badge, verdict, evidence spans.
2. Highlighting: win = green + check, lose = red + cross, tie = gray dash, n/a = gray "insufficient data".
3. Badges: Stated (solid), Inferred (italic/outline), Missing (gray).
4. Exports: Markdown table, CSV (leading `= + - @` are escaped against CSV injection), standalone HTML, PPTX via python-pptx `add_table` with verdict fills.

## Output
Rendered payload + downloadable files from `POST /api/comparisons/{id}/export`.
