"""Pydantic mirrors of schemas/*.json. Run `python -m backend.models` to dump the JSON Schemas."""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

FieldType = Literal["price", "number", "list", "categorical", "boolean", "free_text"]
ComparisonRule = Literal[
    "lower_is_better", "higher_is_better", "presence_is_better", "qualitative_llm", "not_compared"
]
Status = Literal["stated", "inferred", "missing"]
VerdictKind = Literal["win", "lose", "tie", "n/a"]


class FieldDefinition(BaseModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]*$", description="stable snake_case key")
    label: str
    type: FieldType
    comparison_rule: ComparisonRule
    description: str = Field("", description="extraction guidance shown to the model")
    unit: str | None = None
    industry_presets: list[str] = []
    custom: bool = False


class Evidence(BaseModel):
    source_id: str
    quote: str = Field(description="verbatim substring of the source")
    start_char: int
    end_char: int
    verified: bool = False


class Cell(BaseModel):
    field_id: str
    entity_id: str
    value: str | float | list[str] | None = None
    display_value: str = ""
    status: Status
    evidence: list[Evidence] = []
    confidence: float = Field(ge=0, le=1)
    note: str = ""


class Verdict(BaseModel):
    field_id: str
    entity_id: str = Field(description="the competitor being compared to your company")
    verdict: VerdictKind
    rationale: str = ""
    method: Literal["rule", "llm"] = "rule"
    confidence: float | None = None


class Entity(BaseModel):
    id: str
    name: str
    is_your_company: bool
    source_id: str


class Source(BaseModel):
    source_id: str
    entity_id: str
    text: str


class Comparison(BaseModel):
    id: str
    meta: dict[str, Any] = {}
    entities: list[Entity]
    sources: list[Source]
    fields: list[FieldDefinition]
    cells: list[Cell]
    verdicts: list[Verdict]


class VerificationReport(BaseModel):
    checked_cells: int = 0
    downgraded_cells: int = 0
    unverified_quotes: int = 0
    notes: list[str] = []


# ---- API request / response shapes ----

class EntityInput(BaseModel):
    name: str = ""
    text: str

    @field_validator("text")
    @classmethod
    def _non_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("notes must not be empty")
        return v


class CompareRequest(BaseModel):
    your_company: EntityInput
    competitors: list[EntityInput] = Field(min_length=1, max_length=3)
    industry: str = "generic"
    custom_fields: list[FieldDefinition] = []


class CompareResponse(BaseModel):
    comparison: Comparison
    verification_report: VerificationReport


class CellPatch(BaseModel):
    field_id: str
    entity_id: str
    value: str | None = None
    status: Status


class ExportRequest(BaseModel):
    format: Literal["markdown", "csv", "html", "pptx"]


if __name__ == "__main__":
    import json
    from pathlib import Path

    out = Path(__file__).resolve().parent.parent / "schemas"
    out.mkdir(exist_ok=True)
    for m in (FieldDefinition, Cell, Comparison):
        (out / f"{m.__name__}.json").write_text(json.dumps(m.model_json_schema(), indent=2) + "\n")
        print("wrote", out / f"{m.__name__}.json")
