---
name: judging-comparison
description: Produces a win, lose, tie, or n/a verdict for each competitor cell versus your company, using deterministic rules for numeric and presence rows and a model judgment with a one-line rationale for qualitative rows. Use after evidence verification to fill the highlighting layer of the table.
---
# Judging comparison

## Logic (`backend/pipeline.py::rule_verdict`, then `judge`)
- Either side `missing` -> `n/a` with a rationale saying whose notes are silent. Never guess a winner on missing data.
- `lower_is_better` / `higher_is_better`: prices parsed and normalized per month in `backend/numeric.py`; currency mismatch, one-time vs recurring, or conflicting prices -> `n/a`.
- `presence_is_better`: Yes/No comparison.
- `not_compared`: `n/a`, "informational row".
- `qualitative_llm`: one model call per competitor covering all pending rows (`backend/llm.py::judge`, or Jev when `JUDGE=jev`), constrained to the verdict enum, rationale one line.
- Every verdict records `method` = rule | llm; verdicts are always from your company's point of view.

## Output
An array of Verdict objects (see `schemas/Comparison.json`).
