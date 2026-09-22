---
name: verifying-evidence
description: Deterministically verifies that every evidence quote is a substring of its cited source, recomputes character offsets, and downgrades stated cells whose evidence or specific numbers do not check out. Use immediately after extraction as the anti-fabrication gate, before any win/lose judging.
---
# Verifying evidence

## Steps (run exactly this: `backend/pipeline.py::verify`)
1. For every evidence item, confirm `source[start:end] == quote`; otherwise re-find it (exact, then whitespace/case/curly-quote-insensitive). Drop quotes that cannot be found and count them.
2. A `stated` cell with no surviving quote is downgraded: to `missing` for price/number/boolean fields, to `inferred` for text fields.
3. `normalize` enforces types: a stated price/number must appear inside a verified quote or the cell becomes `inferred`; prices are normalized to per-month and conflicts are flagged; booleans become Yes/No or `missing`.
4. Optional attachment: when `TYPESAFE_API_KEY` is set, `backend/jev.py::support_check` asks Jev whether each quote actually supports the value (semantic check the substring test cannot do) and downgrades on a confident no.

## Output
The same cells with `verified` flags and possibly downgraded statuses, plus a VerificationReport {checked_cells, downgraded_cells, unverified_quotes, notes}.
