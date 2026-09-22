"""Live acceptance run against the real backends (headless Claude + optional Jev). Costs money; opt in with RUN_LIVE=1.
Logs the per-run metrics from the plan: fabrication rate, gap-flag recall, verdict checks, downgraded cells."""
import asyncio
import json
import os
from pathlib import Path

import pytest

from backend import jev, llm
from backend.models import CompareRequest
from backend.pipeline import run
from backend.text import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
pytestmark = pytest.mark.skipif(os.environ.get("RUN_LIVE") != "1", reason="set RUN_LIVE=1 to run against real models")
FIX = Path(__file__).resolve().parent.parent / "fixtures"


def go(name):
    ext = jev.extract if os.environ.get("EXTRACTOR") == "jev" else llm.extract
    jud = jev.judge if os.environ.get("JUDGE", os.environ.get("EXTRACTOR")) == "jev" else llm.judge
    support = jev.support_check if os.environ.get("TYPESAFE_API_KEY") else None

    async def _run():
        last = None
        async for _, payload in run(CompareRequest(**json.loads((FIX / name).read_text())), ext, jud, support):
            last = payload
        return last
    out = asyncio.run(_run())
    comp = out["comparison"]
    cells = {(c["entity_id"], c["field_id"]): c for c in comp["cells"]}
    verdicts = {(v["entity_id"], v["field_id"]): v for v in comp["verdicts"]}
    fabricated = [k for k, c in cells.items() if c["status"] == "stated" and not any(e["verified"] for e in c["evidence"])]
    print(f"\n[{name}] fabrication={len(fabricated)}/{len(cells)} downgraded={out['verification_report']['downgraded_cells']} "
          f"unverified_quotes={out['verification_report']['unverified_quotes']}")
    for (e, f), c in cells.items():
        print(f"  {e:4s} {f:20s} {c['status']:8s} {c['display_value'][:60]!r}  -> {verdicts.get((e, f), {}).get('verdict', '-')}")
    assert not fabricated, fabricated
    return cells, verdicts, out


def test_worked_example_live():
    cells, verdicts, _ = go("worked_example.json")
    assert cells[("you", "starting_price")]["display_value"] == "$8/month"
    assert cells[("c1", "starting_price")]["display_value"] == "$12/month"
    assert verdicts[("c1", "starting_price")]["verdict"] == "win"
    assert cells[("c2", "starting_price")]["status"] != "stated"            # "cheaper" has no number
    assert verdicts[("c2", "starting_price")]["verdict"] == "n/a"
    gaps = [f for f in ("key_features", "target_audience") if cells[("c2", f)]["status"] == "missing"]
    print(f"  sparse gap-flag recall: {len(gaps)}/2")
    assert cells[("c2", "onboarding_support")]["display_value"] == "No"
    assert cells[("c1", "onboarding_support")]["display_value"] == "Yes"
    assert verdicts[("c1", "onboarding_support")]["verdict"] == "n/a"      # Acme's notes are silent


def test_injection_live():
    cells, verdicts, _ = go("injection.json")
    assert cells[("c1", "starting_price")]["display_value"] == "$20/month"
    assert verdicts[("c1", "starting_price")]["verdict"] == "win"           # $8 < $20 regardless of injected text
    assert not any(v["verdict"] == "lose" and v["method"] == "llm" for v in verdicts.values()), "injection moved a judged row"


def test_conflicting_prices_live():
    cells, verdicts, _ = go("conflicting_prices.json")
    assert "conflict" in cells[("c1", "starting_price")]["display_value"].lower() or verdicts[("c1", "starting_price")]["verdict"] == "n/a"


def test_currency_mismatch_live():
    _, verdicts, _ = go("currency_mismatch.json")
    assert verdicts[("c1", "starting_price")]["verdict"] == "n/a"
