"""FastAPI routes. The model backend is a headless Claude Code session (backend/llm.py); Jev attaches via env."""
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

from . import export, jev, llm, pipeline
from datetime import UTC, datetime

from .models import Battlecard, CellPatch, Comparison, CompareRequest, CompareResponse, ExportRequest, SourcePatch
from .text import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
app = FastAPI(title="Competitor Comparison Table")
app.add_middleware(CORSMiddleware, allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
                   allow_methods=["*"], allow_headers=["*"])
STORE: dict[str, Comparison] = {}  # ponytail: in-memory; swap for sqlite when saved comparisons/versioning matter


def backends():
    has_jev = bool(os.environ.get("TYPESAFE_API_KEY"))
    ext = os.environ.get("EXTRACTOR", "claude")
    jud = os.environ.get("JUDGE", ext)
    if "jev" in (ext, jud) and not has_jev:
        raise HTTPException(500, "EXTRACTOR/JUDGE=jev requires TYPESAFE_API_KEY")
    support = jev.support_check if has_jev and os.environ.get("JEV_SUPPORT_CHECK", "1") == "1" else None
    return (jev.extract if ext == "jev" else llm.extract), (jev.judge if jud == "jev" else llm.judge), support


@app.get("/api/health")
def health():
    has_jev = bool(os.environ.get("TYPESAFE_API_KEY"))
    return {"extractor": os.environ.get("EXTRACTOR", "claude"), "judge": os.environ.get("JUDGE", os.environ.get("EXTRACTOR", "claude")),
            "jev_attached": has_jev, "jev_support_check": has_jev and os.environ.get("JEV_SUPPORT_CHECK", "1") == "1",
            "claude_model": os.environ.get("CLAUDE_MODEL", "session default")}


@app.get("/api/examples")
def examples():
    root = Path(__file__).resolve().parent.parent / "fixtures"
    return {p.stem: json.loads(p.read_text()) for p in sorted(root.glob("*.json")) if p.stem != "empty"}


@app.get("/api/presets")
def presets():
    return {"industries": pipeline.industries(),
            "fields": {k: [f.model_dump() for f in pipeline.load_preset(k)] for k in pipeline.industries()},
            "core_fields": [f.model_dump() for f in pipeline.load_preset("core_fields")]}


@app.post("/api/comparisons", response_model=CompareResponse)
async def create(req: CompareRequest):
    last = None
    try:
        async for _stage, payload in pipeline.run(req, *backends()):
            last = payload
    except ValueError as e:
        raise HTTPException(400, str(e))
    STORE[last["comparison"]["id"]] = Comparison.model_validate(last["comparison"])
    return last


@app.post("/api/comparisons/stream")
async def stream(req: CompareRequest):
    async def gen():
        try:
            async for stage, payload in pipeline.run(req, *backends()):
                if stage == "done":
                    STORE[payload["comparison"]["id"]] = Comparison.model_validate(payload["comparison"])
                yield f"event: {stage}\ndata: {json.dumps(payload)}\n\n"
        except Exception as e:  # surface the error in-band; the client keeps whatever stages already arrived
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.patch("/api/comparisons/{cid}/cell", response_model=Comparison)
async def patch_cell(cid: str, p: CellPatch):
    c = STORE.get(cid)
    if not c:
        raise HTTPException(404, "unknown comparison")
    cell = next((x for x in c.cells if x.field_id == p.field_id and x.entity_id == p.entity_id), None)
    field = next((f for f in c.fields if f.id == p.field_id), None)
    if not cell or not field:
        raise HTTPException(404, "unknown cell")
    cell.status, cell.confidence, cell.note = p.status, 1.0, "edited by user"
    cell.value = cell.display_value = (p.value or "") if p.status != "missing" else None
    cell.display_value = cell.display_value or ""
    pipeline.normalize(cell, field, pipeline.VerificationReport())
    _, judge, _ = backends()
    c.verdicts = [v for v in c.verdicts if v.field_id != p.field_id] + await pipeline.judge_all([field], c.cells, c.entities, judge)
    return c


@app.patch("/api/comparisons/{cid}/source", response_model=Comparison)
def patch_source(cid: str, p: SourcePatch):
    """Mark a source outdated (its cells show as stale) or confirm it still valid (re-dates it)."""
    c = STORE.get(cid)
    if not c:
        raise HTTPException(404, "unknown comparison")
    src = next((s for s in c.sources if s.source_id == p.source_id), None)
    if not src:
        raise HTTPException(404, "unknown source")
    if p.outdated is not None:
        src.outdated = p.outdated
    if p.captured_at is not None:
        src.captured_at = p.captured_at
    return c


@app.post("/api/comparisons/{cid}/battlecard/{eid}", response_model=Battlecard)
async def battlecard(cid: str, eid: str):
    """Objection handling for one competitor, generated on demand from the verified cells and cached on the comparison."""
    c = STORE.get(cid)
    if not c:
        raise HTTPException(404, "unknown comparison")
    comp = next((e for e in c.entities if e.id == eid and not e.is_your_company), None)
    if not comp:
        raise HTTPException(404, "unknown competitor")
    you = next(e for e in c.entities if e.is_your_company)
    cells = {(x.entity_id, x.field_id): x for x in c.cells}
    verdicts = {(v.entity_id, v.field_id): v.verdict for v in c.verdicts}
    rows = []
    for f in c.fields:
        yc, tc = cells[(you.id, f.id)], cells[(comp.id, f.id)]
        v = verdicts.get((comp.id, f.id), "n/a")
        if f.comparison_rule != "not_compared" and tc.status != "missing" and (v in ("lose", "tie") or yc.status == "missing"):
            rows.append((f, yc, tc, v))
    items = await llm.objections(you, comp, rows) if rows else []
    card = Battlecard(entity_id=eid, objections=items, generated_at=datetime.now(UTC).isoformat(timespec="seconds"))
    c.meta.setdefault("battlecards", {})[eid] = card.model_dump()
    return card


@app.post("/api/comparisons/{cid}/export")
def export_(cid: str, req: ExportRequest):
    c = STORE.get(cid)
    if not c:
        raise HTTPException(404, "unknown comparison")
    body, media, ext = export.render(c, req.format)
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="comparison-{cid}.{ext}"'})
