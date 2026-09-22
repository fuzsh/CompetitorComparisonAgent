from backend.models import Cell, Evidence, FieldDefinition, Source
from backend.pipeline import verify

SRC = Source(source_id="src_c1", entity_id="c1", text="NoteRival — 'The workspace for fast teams.' Pricing starts at $12/seat/month billed annually.")
PRICE = FieldDefinition(id="starting_price", label="Starting price", type="price", comparison_rule="lower_is_better")
TEXT = FieldDefinition(id="positioning_angle", label="Positioning", type="free_text", comparison_rule="not_compared")


def cell(field, quote, value, status="stated", start=0, end=0):
    return Cell(field_id=field.id, entity_id="c1", value=value, display_value=value, status=status, confidence=0.9,
                evidence=[Evidence(source_id="src_c1", quote=quote, start_char=start, end_char=end)])


def test_real_quote_is_verified_and_offsets_recomputed():
    c = cell(PRICE, "Pricing starts at $12/seat/month billed annually.", "$12/seat/month")
    rep = verify([c], [SRC], [PRICE])
    e = c.evidence[0]
    assert e.verified and SRC.text[e.start_char:e.end_char] == e.quote
    assert c.status == "stated" and c.display_value == "$12/month" and rep.downgraded_cells == 0


def test_fabricated_quote_downgrades_price_to_missing():
    c = cell(PRICE, "Only $5 per month!", "$5/month")
    rep = verify([c], [SRC], [PRICE])
    assert c.status == "missing" and c.evidence == [] and c.value is None
    assert rep.unverified_quotes == 1 and rep.downgraded_cells == 1


def test_stated_price_not_in_quote_becomes_inferred():
    c = cell(PRICE, "Pricing starts at $12/seat/month billed annually.", "$9/month")
    verify([c], [SRC], [PRICE])
    assert c.status == "inferred" and "not present in the quoted evidence" in c.note


def test_whitespace_and_curly_quote_tolerant_match():
    c = cell(TEXT, "noterival — ‘the workspace   for fast teams.’", "The workspace for fast teams")
    verify([c], [SRC], [TEXT])
    assert c.evidence[0].verified and c.status == "stated"


def test_no_stated_cell_survives_without_verified_quote():
    cells = [cell(PRICE, "Only $5 per month!", "$5/month"), cell(TEXT, "made up tagline", "made up")]
    verify(cells, [SRC], [PRICE, TEXT])
    assert all(c.status != "stated" or any(e.verified for e in c.evidence) for c in cells)  # fabrication rate = 0
