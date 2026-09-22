"""End-to-end pipeline with scripted fakes standing in for the model (no network)."""
import asyncio
import json
from pathlib import Path

from backend.models import Cell, CompareRequest, Evidence
from backend.pipeline import run
from backend.text import find_quote

FIX = Path(__file__).resolve().parent.parent / "fixtures"

# entity_id -> field_id -> (status, value, quote)
SCRIPT = {
    "you": {"starting_price": ("stated", "$8/user/month", "$8/user/month."),
            "key_features": ("stated", "real-time collaboration, AI summaries, SSO on the top tier", "Features: real-time collaboration, AI summaries, SSO on the top tier."),
            "target_audience": ("stated", "mid-size product teams", "For mid-size product teams.")},
    "c1": {"starting_price": ("stated", "$12/seat/month", "Pricing starts at $12/seat/month billed annually."),
           "key_features": ("stated", "real-time editing, templates, 24/7 onboarding support", "Includes real-time editing, templates, and 24/7 onboarding support."),
           "target_audience": ("stated", "enterprise teams", "Aimed at enterprise teams."),
           "positioning_angle": ("stated", "The workspace for fast teams", "'The workspace for fast teams.'"),
           "onboarding_support": ("stated", "Yes", "Includes real-time editing, templates, and 24/7 onboarding support.")},
    "c2": {"starting_price": ("inferred", "cheaper", "I think they're cheaper but don't do onboarding support."),
           "notable_weakness": ("inferred", "no onboarding support", "I think they're cheaper but don't do onboarding support."),
           "onboarding_support": ("stated", "No", "I think they're cheaper but don't do onboarding support."),
           "free_trial": ("stated", "Yes", "Free 30-day trial for everyone!")},  # fabricated quote -> must be caught
}
JUDGE = {"key_features": ("tie", "both strong, different sets"), "target_audience": ("tie", "different segments")}


async def fake_extract(entity, text, fields):
    out = []
    for f in fields:
        if f.id in SCRIPT.get(entity.id, {}):
            status, value, quote = SCRIPT[entity.id][f.id]
            s, e = find_quote(text, quote) or (0, 0)
            out.append(Cell(field_id=f.id, entity_id=entity.id, value=value, display_value=value, status=status, confidence=0.9,
                            evidence=[Evidence(source_id=entity.source_id, quote=quote, start_char=s, end_char=e)]))
        else:
            out.append(Cell(field_id=f.id, entity_id=entity.id, status="missing", confidence=0.9, note="not in notes"))
    return out


async def fake_judge(you, comp, pairs):
    return [{"field_id": f.id, "verdict": JUDGE.get(f.id, ("n/a", ""))[0], "rationale": JUDGE.get(f.id, ("", "vague"))[1]} for f, _, _ in pairs]


def run_fixture(name):
    async def go():
        last = None
        async for stage, payload in run(CompareRequest(**json.loads((FIX / name).read_text())), fake_extract, fake_judge):
            last = payload
        return last
    return asyncio.run(go())


def test_worked_example():
    out = run_fixture("worked_example.json")
    comp, rep = out["comparison"], out["verification_report"]
    cell = {(c["entity_id"], c["field_id"]): c for c in comp["cells"]}
    verdict = {(v["entity_id"], v["field_id"]): v for v in comp["verdicts"]}

    # well-documented competitor: stated cells with verified quotes; rule-based price win for Acme
    assert cell[("you", "starting_price")]["display_value"] == "$8/month"
    assert cell[("c1", "starting_price")]["display_value"] == "$12/month"
    assert all(e["verified"] for e in cell[("c1", "starting_price")]["evidence"])
    assert verdict[("c1", "starting_price")]["verdict"] == "win" and verdict[("c1", "starting_price")]["method"] == "rule"

    # sparse competitor: inferred price with no number -> n/a; gaps flagged missing, not guessed
    assert cell[("c2", "starting_price")]["status"] == "inferred"
    assert verdict[("c2", "starting_price")]["verdict"] == "n/a"
    assert cell[("c2", "key_features")]["status"] == "missing" and cell[("c2", "target_audience")]["status"] == "missing"

    # onboarding: stated Yes / No, but Acme's notes are silent -> n/a, never a guessed winner
    assert cell[("c1", "onboarding_support")]["display_value"] == "Yes" and cell[("c2", "onboarding_support")]["display_value"] == "No"
    assert cell[("you", "onboarding_support")]["status"] == "missing"
    assert verdict[("c1", "onboarding_support")]["verdict"] == "n/a" and verdict[("c2", "onboarding_support")]["verdict"] == "n/a"

    # qualitative rows go to the judge; informational rows are n/a by rule
    assert verdict[("c1", "key_features")] | {} and verdict[("c1", "key_features")]["method"] == "llm" and verdict[("c1", "key_features")]["verdict"] == "tie"
    assert verdict[("c1", "positioning_angle")]["verdict"] == "n/a" and verdict[("c1", "positioning_angle")]["method"] == "rule"

    # anti-fabrication: the invented free-trial quote is caught and the cell downgraded to missing
    assert cell[("c2", "free_trial")]["status"] == "missing" and rep["unverified_quotes"] == 1 and rep["downgraded_cells"] >= 1
    assert all(c["status"] != "stated" or any(e["verified"] for e in c["evidence"]) for c in comp["cells"])  # fabrication rate = 0

    # it is a real table: every entity x field has exactly one cell
    assert len(comp["cells"]) == len(comp["entities"]) * len(comp["fields"])


def test_custom_field_and_preset_change_rows_without_code():
    req = json.loads((FIX / "worked_example.json").read_text())
    req["industry"] = "hardware"
    req["custom_fields"] = [{"id": "sso", "label": "SSO support", "type": "boolean", "comparison_rule": "presence_is_better"}]
    async def go():
        async for stage, payload in run(CompareRequest(**req), fake_extract, fake_judge):
            if stage == "schema":
                return [f["id"] for f in payload["fields"]]
    ids = asyncio.run(go())
    assert ids[:5] == ["starting_price", "key_features", "target_audience", "positioning_angle", "notable_weakness"]
    assert "battery_life_hours" in ids and ids[-1] == "sso" and "onboarding_support" not in ids


def test_empty_notes_rejected():
    import pytest
    with pytest.raises(Exception):
        CompareRequest(**json.loads((FIX / "empty.json").read_text()))
