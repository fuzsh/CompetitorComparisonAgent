"""Model backend: a headless Claude Code session (`claude -p --json-schema ...`).
No API key is needed; it uses the local Claude Code login. The CLI validates the JSON against the schema and we
re-validate with pydantic. Nothing here is trusted: `pipeline.verify` re-checks every quote against the source."""
import asyncio
import json
import os
from asyncio.subprocess import PIPE
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from .models import Cell, Entity, Evidence, FieldDefinition, Status
from .text import find_quote

PROMPTS = Path(__file__).resolve().parent.parent / "prompts"
SYSTEM_EXTRACT = (PROMPTS / "extraction_system.md").read_text()
SYSTEM_JUDGE = (PROMPTS / "judge_system.md").read_text()
SYSTEM_BATTLECARD = (PROMPTS / "battlecard_system.md").read_text()


class ExtractedEvidence(BaseModel):
    quote: str


class ExtractedCell(BaseModel):
    field_id: str
    value: str | None
    status: Status
    evidence: list[ExtractedEvidence]
    confidence: float
    note: str


class Extraction(BaseModel):
    cells: list[ExtractedCell]


class JudgedVerdict(BaseModel):
    field_id: str
    verdict: Literal["win", "lose", "tie", "n/a"]
    rationale: str


class Judgement(BaseModel):
    verdicts: list[JudgedVerdict]


class ObjectionItem(BaseModel):
    field_id: str
    objection: str
    response: str


class Objections(BaseModel):
    items: list[ObjectionItem]


async def ask(system: str, prompt: str, schema: type[BaseModel]) -> BaseModel:
    """One headless, tool-less Claude turn constrained to `schema`."""
    args = [os.environ.get("CLAUDE_BIN", "claude"), "-p", "--no-session-persistence", "--tools", "", "--output-format", "json",
            "--json-schema", json.dumps(schema.model_json_schema()), "--system-prompt", system]
    if model := os.environ.get("CLAUDE_MODEL"):
        args += ["--model", model]
    env = {k: v for k, v in os.environ.items() if k not in ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT")}  # allow nesting
    proc = await asyncio.create_subprocess_exec(*args, stdin=PIPE, stdout=PIPE, stderr=PIPE, env=env)
    out, err = await asyncio.wait_for(proc.communicate(prompt.encode()), timeout=float(os.environ.get("CLAUDE_TIMEOUT", "300")))
    if not out.strip():
        raise RuntimeError(f"claude exited {proc.returncode}: {err.decode(errors='replace')[:500]}")
    data = json.loads(out)
    if data.get("is_error") or data.get("structured_output") is None:
        raise RuntimeError(f"claude: {str(data.get('result'))[:500]}")
    return schema.model_validate(data["structured_output"])


def fields_block(fields: list[FieldDefinition]) -> str:
    return "\n".join(f"- {f.id} ({f.type}): {f.label}. {f.description}" for f in fields)


async def extract(entity: Entity, text: str, fields: list[FieldDefinition]) -> list[Cell]:
    prompt = (f"Entity: {entity.name}\n\nFields to extract (field_id (type): label. guidance):\n{fields_block(fields)}\n\n"
              f'<notes source_id="{entity.source_id}">\n{text}\n</notes>\n\nReturn exactly one cell per field_id above, in that order.')
    r: Extraction = await ask(SYSTEM_EXTRACT, prompt, Extraction)
    by = {c.field_id: c for c in r.cells}
    cells = []
    for f in fields:
        c = by.get(f.id)
        if c is None:
            cells.append(Cell(field_id=f.id, entity_id=entity.id, status="missing", confidence=0.0, note="model returned no cell"))
            continue
        evidence = []
        for e in c.evidence:
            start, end = find_quote(text, e.quote) or (0, 0)
            evidence.append(Evidence(source_id=entity.source_id, quote=e.quote, start_char=start, end_char=end))
        cells.append(Cell(field_id=f.id, entity_id=entity.id, value=c.value, display_value=c.value or "", status=c.status,
                          evidence=evidence, confidence=min(max(c.confidence, 0.0), 1.0), note=c.note))
    return cells


async def judge(you: Entity, comp: Entity, pairs: list[tuple[FieldDefinition, Cell, Cell]]) -> list[dict]:
    rows = "\n".join(f'- {f.id} ({f.label}): {you.name}: "{y.display_value}" | {comp.name}: "{t.display_value}"' for f, y, t in pairs)
    prompt = f"Our company: {you.name}. Competitor: {comp.name}.\n\nRows:\n{rows}\n\nReturn one verdict per field_id above."
    r: Judgement = await ask(SYSTEM_JUDGE, prompt, Judgement)
    wanted = {f.id for f, _, _ in pairs}
    return [{"field_id": v.field_id, "verdict": v.verdict, "rationale": v.rationale} for v in r.verdicts if v.field_id in wanted]


async def objections(you: Entity, comp: Entity, rows: list[tuple[FieldDefinition, Cell, Cell, str]]) -> list[dict]:
    """Objection handling for the battlecard. `rows` = (field, your_cell, their_cell, verdict) for rows worth preparing."""
    def side(name: str, c: Cell) -> str:
        quote = " ".join(e.quote for e in c.evidence if e.verified)
        return f'{name}: "{c.display_value or "not in our notes"}"' + (f' (their notes say: "{quote}")' if quote else "")
    lines = "\n".join(f"- {f.id} ({f.label}) verdict={v}: {side(you.name, y)} | {side(comp.name, t)}" for f, y, t, v in rows)
    prompt = f"Our company: {you.name}. Competitor: {comp.name}.\n\nRows:\n{lines}\n\nWrite at most 4 objection/response pairs, one per field_id, most damaging first."
    r: Objections = await ask(SYSTEM_BATTLECARD, prompt, Objections)
    wanted = {f.id for f, _, _, _ in rows}
    return [{"field_id": i.field_id, "objection": i.objection, "response": i.response} for i in r.items if i.field_id in wanted][:4]
