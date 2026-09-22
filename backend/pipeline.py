"""Deterministic orchestrator (skills 1..7). The model is called in exactly two places:
`extractor` (skill 3, extracting-evidence) and `judge` (skill 6, qualitative rows only).
Both are plain async callables injected by main.py, so tests can pass fakes and Jev can be attached."""
import asyncio
import json
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path

from .models import (Cell, Comparison, CompareRequest, CompareResponse, Entity, FieldDefinition, Source,
                     VerificationReport, Verdict)
from .numeric import compare_numbers, compare_prices, first_number, parse_prices
from .text import find_quote, sentences, trim

PRESETS = Path(__file__).resolve().parent.parent / "presets"
MAX_SENTENCES = 200  # ponytail: hard cap; chunk long notes if anyone pastes a whole website

Extractor = Callable[[Entity, str, list[FieldDefinition]], Awaitable[list[Cell]]]
# judge(you, competitor, [(field, your_cell, their_cell)]) -> [{"field_id","verdict","rationale","confidence"?}]
Judge = Callable[[Entity, Entity, list[tuple[FieldDefinition, Cell, Cell]]], Awaitable[list[dict]]]
SupportCheck = Callable[[list[Cell], list[FieldDefinition], list[Source]], Awaitable[list[str]]]


# ---------------- 1. segmenting-notes ----------------
def segment(req: CompareRequest) -> tuple[list[Entity], list[Source]]:
    blocks = [("you", req.your_company.name.strip() or "Your Company", True, req.your_company.text)]
    blocks += [(f"c{i}", c.name.strip() or f"Competitor {i}", False, c.text) for i, c in enumerate(req.competitors, 1)]
    entities, sources = [], []
    for eid, name, is_you, text in blocks:
        n = len(sentences(text))
        if n == 0:
            raise ValueError(f"{name}: notes contain no sentences")
        if n > MAX_SENTENCES:
            raise ValueError(f"{name}: notes too long ({n} sentences, max {MAX_SENTENCES})")
        entities.append(Entity(id=eid, name=name, is_your_company=is_you, source_id=f"src_{eid}"))
        sources.append(Source(source_id=f"src_{eid}", entity_id=eid, text=text))
    return entities, sources


# ---------------- 2. selecting-schema ----------------
def load_preset(name: str) -> list[FieldDefinition]:
    p = PRESETS / f"{name}.json"
    return [FieldDefinition(**f) for f in json.loads(p.read_text())] if p.exists() else []


def industries() -> dict[str, list[str]]:
    out = {"generic": []}
    for p in sorted(PRESETS.glob("*.json")):
        if p.stem != "core_fields":
            out[p.stem] = [f.label for f in load_preset(p.stem)]
    return out


def select_schema(industry: str, custom: list[FieldDefinition]) -> list[FieldDefinition]:
    merged = load_preset("core_fields") + load_preset(industry) + [f.model_copy(update={"custom": True}) for f in custom]
    seen: set[str] = set()
    return [f for f in merged if not (f.id in seen or seen.add(f.id))]


# ---------------- 4. verifying-evidence (deterministic anti-fabrication gate) ----------------
def _downgrade(cell: Cell, to: str, why: str, rep: VerificationReport) -> None:
    cell.status = to
    cell.note = "; ".join(x for x in (cell.note, why) if x)
    rep.downgraded_cells += 1
    rep.notes.append(f"{cell.entity_id}/{cell.field_id}: {cell.status} — {why}")
    if to == "missing":
        cell.value, cell.display_value, cell.evidence = None, "", []


def normalize(cell: Cell, field: FieldDefinition, rep: VerificationReport) -> None:
    """Type-specific normalization + the 'specific number must appear in a verified quote' rule."""
    if cell.status == "missing":
        cell.value, cell.display_value = None, ""
        return
    quotes = " ".join(e.quote for e in cell.evidence)
    text = cell.display_value or (str(cell.value) if cell.value is not None else "")
    if field.type == "price":
        claimed, quoted = parse_prices(text) or parse_prices(quotes), parse_prices(quotes)
        if not claimed:
            cell.value = cell.display_value = text or trim(quotes)
            if cell.status == "stated":
                _downgrade(cell, "inferred", "no concrete price in the notes", rep)
            return
        if cell.status == "stated" and not {p.amount for p in claimed} <= {p.amount for p in quoted}:
            _downgrade(cell, "inferred", "price is not present in the quoted evidence", rep)
        if len({p.per_month for p in claimed}) > 1:
            cell.value = [p.fmt() for p in claimed]
            cell.display_value = "; ".join(cell.value) + " (conflict)"
            cell.note = "; ".join(x for x in (cell.note, "conflicting prices in notes; not compared") if x)
        else:
            cell.value, cell.display_value = claimed[0].per_month, claimed[0].fmt()
            if claimed[0].period == "unspecified":
                cell.note = "; ".join(x for x in (cell.note, "billing period not stated; assumed monthly") if x)
    elif field.type == "number":
        n = first_number(text) if text else first_number(quotes)
        if n is None:
            cell.value = cell.display_value = text or trim(quotes)
            if cell.status == "stated":
                _downgrade(cell, "inferred", "no concrete number in the notes", rep)
            return
        if cell.status == "stated" and first_number(quotes) is None:
            _downgrade(cell, "inferred", "number is not present in the quoted evidence", rep)
        cell.value, cell.display_value = n, f"{n:g}{' ' + field.unit if field.unit else ''}"
    elif field.type == "boolean":
        v = text.strip().lower()
        if v in ("yes", "true", "y", "present", "included"):
            cell.value = cell.display_value = "Yes"
        elif v in ("no", "false", "n", "absent", "not offered"):
            cell.value = cell.display_value = "No"
        else:
            _downgrade(cell, "missing", "boolean value unclear from notes", rep)
    else:
        cell.value = cell.display_value = text or trim(quotes, 160)


def verify(cells: list[Cell], sources: list[Source], fields: list[FieldDefinition]) -> VerificationReport:
    text = {s.source_id: s.text for s in sources}
    by_field = {f.id: f for f in fields}
    rep = VerificationReport()
    for cell in cells:
        if cell.evidence:
            rep.checked_cells += 1
        kept = []
        for e in cell.evidence:
            src = text.get(e.source_id, "")
            if src[e.start_char:e.end_char] != e.quote:
                span = find_quote(src, e.quote)
                if span is None:
                    rep.unverified_quotes += 1
                    continue
                e.start_char, e.end_char = span
                e.quote = src[span[0]:span[1]]
            e.verified = True
            kept.append(e)
        cell.evidence = kept
        if cell.status == "stated" and not kept:
            to = "missing" if by_field[cell.field_id].type in ("price", "number", "boolean") else "inferred"
            _downgrade(cell, to, "no verbatim quote matched the notes", rep)
        normalize(cell, by_field[cell.field_id], rep)
    return rep


# ---------------- 6. judging-comparison ----------------
def rule_verdict(f: FieldDefinition, you: Cell, them: Cell) -> Verdict | None:
    v = lambda verdict, why: Verdict(field_id=f.id, entity_id=them.entity_id, verdict=verdict, rationale=why, method="rule")
    if f.comparison_rule == "not_compared":
        return v("n/a", "informational row; not compared")
    if you.status == "missing" and them.status == "missing":
        return v("n/a", "insufficient data: neither side's notes cover this")
    if you.status == "missing":
        return v("n/a", "insufficient data: your notes do not cover this")
    if them.status == "missing":
        return v("n/a", "insufficient data: their notes do not cover this")
    suffix = " (based on an inferred value)" if "inferred" in (you.status, them.status) else ""
    if f.comparison_rule in ("lower_is_better", "higher_is_better"):
        if isinstance(you.value, list) or isinstance(them.value, list):
            return v("n/a", "conflicting prices in notes; not compared")
        if f.type == "price":
            py, pt = parse_prices(you.display_value), parse_prices(them.display_value)
            if not py or not pt:
                return v("n/a", "no comparable price in notes")
            verdict, why = compare_prices(py[0], pt[0])
        else:
            ny, nt = first_number(you.display_value), first_number(them.display_value)
            if ny is None or nt is None:
                return v("n/a", "no comparable number in notes")
            verdict, why = compare_numbers(ny, nt, f.comparison_rule == "higher_is_better", f.unit or "")
        return v(verdict, why + suffix)
    if f.comparison_rule == "presence_is_better":
        y, t = you.display_value == "Yes", them.display_value == "Yes"
        if y and not t:
            return v("win", "you have it, they don't" + suffix)
        if t and not y:
            return v("lose", "they have it, you don't" + suffix)
        return v("tie", ("both have it" if y else "neither has it") + suffix)
    return None  # qualitative_llm -> model


async def judge_all(fields: list[FieldDefinition], cells: list[Cell], entities: list[Entity], judge: Judge) -> list[Verdict]:
    by = {(c.entity_id, c.field_id): c for c in cells}
    you = next(e for e in entities if e.is_your_company)

    async def one(comp: Entity) -> list[Verdict]:
        out, pending = [], []
        for f in fields:
            yc, tc = by[(you.id, f.id)], by[(comp.id, f.id)]
            rv = rule_verdict(f, yc, tc)
            (out.append(rv) if rv else pending.append((f, yc, tc)))
        if pending:
            for j in await judge(you, comp, pending):
                out.append(Verdict(field_id=j["field_id"], entity_id=comp.id, verdict=j["verdict"], rationale=j.get("rationale", ""),
                                   method="llm", confidence=j.get("confidence")))
        return out

    return [v for vs in await asyncio.gather(*(one(c) for c in entities if not c.is_your_company)) for v in vs]


# ---------------- run ----------------
async def run(req: CompareRequest, extractor: Extractor, judge: Judge, support_check: SupportCheck | None = None):
    """Async generator yielding (stage, payload) so the API can stream progress; the last stage is 'done'."""
    entities, sources = segment(req)
    yield "segment", {"entities": [e.model_dump() for e in entities], "sources": [s.model_dump() for s in sources]}
    fields = select_schema(req.industry, req.custom_fields)
    yield "schema", {"fields": [f.model_dump() for f in fields]}
    text = {s.entity_id: s.text for s in sources}
    results = await asyncio.gather(*(extractor(e, text[e.id], fields) for e in entities))
    cells = [c for cs in results for c in cs]
    yield "extract", {"cells": [c.model_dump() for c in cells]}
    report = verify(cells, sources, fields)
    if support_check:
        report.notes += await support_check(cells, fields, sources)
    yield "verify", report.model_dump() | {"cells": [c.model_dump() for c in cells]}
    verdicts = await judge_all(fields, cells, entities, judge)
    yield "judge", {"verdicts": [v.model_dump() for v in verdicts]}
    comparison = Comparison(
        id=uuid.uuid4().hex[:12],
        meta={"industry": req.industry, "created_at": datetime.now(UTC).isoformat(timespec="seconds"), "your_company_entity_id": "you"},
        entities=entities, sources=sources, fields=fields, cells=cells, verdicts=verdicts,
    )
    yield "done", CompareResponse(comparison=comparison, verification_report=report).model_dump()
