"""Offline API tests: the routes around a stored comparison, with the model calls replaced by the scripted fakes."""
import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend import main
from tests.test_pipeline import fake_extract, fake_judge

FIX = Path(__file__).resolve().parent.parent / "fixtures"


def make_client(monkeypatch):
    monkeypatch.setattr(main, "backends", lambda: (fake_extract, fake_judge, None))

    async def fake_objections(you, comp, rows):
        return [{"field_id": f.id, "objection": f"{comp.name} has {f.label}: {t.display_value}.", "response": "Not in our notes; confirm internally."} for f, y, t, v in rows]

    monkeypatch.setattr(main.llm, "objections", fake_objections)
    return TestClient(main.app)


def create(client):
    req = json.loads((FIX / "worked_example.json").read_text())
    req["competitors"][0] |= {"kind": "public", "captured_at": "2026-05-01"}
    r = client.post("/api/comparisons", json=req)
    assert r.status_code == 200, r.text
    return r.json()["comparison"]


def test_sources_and_source_patch(monkeypatch):
    client = make_client(monkeypatch)
    c = create(client)
    src = {s["source_id"]: s for s in c["sources"]}
    assert src["src_c1"]["kind"] == "public" and src["src_c1"]["captured_at"] == "2026-05-01" and src["src_c1"]["title"] == "NoteRival notes"
    assert src["src_you"]["kind"] == "notes"

    r = client.patch(f"/api/comparisons/{c['id']}/source", json={"source_id": "src_c1", "outdated": True})
    assert r.status_code == 200 and [s for s in r.json()["sources"] if s["source_id"] == "src_c1"][0]["outdated"] is True
    r = client.patch(f"/api/comparisons/{c['id']}/source", json={"source_id": "src_c1", "outdated": False, "captured_at": "2026-09-22"})
    s = [s for s in r.json()["sources"] if s["source_id"] == "src_c1"][0]
    assert s["outdated"] is False and s["captured_at"] == "2026-09-22"
    assert client.patch(f"/api/comparisons/{c['id']}/source", json={"source_id": "nope", "outdated": True}).status_code == 404


def test_battlecard_prepares_only_rows_that_need_it(monkeypatch):
    client = make_client(monkeypatch)
    c = create(client)
    r = client.post(f"/api/comparisons/{c['id']}/battlecard/c1")
    assert r.status_code == 200
    card = r.json()
    ids = {o["field_id"] for o in card["objections"]}
    # NoteRival states onboarding support while Acme's notes are silent -> worth preparing; the price row is a clear win -> not offered
    assert "onboarding_support" in ids and "starting_price" not in ids
    assert "positioning_angle" not in ids  # informational rows are never prepared
    # cached on the comparison
    assert client.post(f"/api/comparisons/{c['id']}/export", json={"format": "markdown"}).status_code == 200
    assert client.post(f"/api/comparisons/{c['id']}/battlecard/you").status_code == 404
