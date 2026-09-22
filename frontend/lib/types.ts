export type Status = "stated" | "inferred" | "missing";
export type VerdictKind = "win" | "lose" | "tie" | "n/a";
export type FieldType = "price" | "number" | "list" | "categorical" | "boolean" | "free_text";
export type ComparisonRule = "lower_is_better" | "higher_is_better" | "presence_is_better" | "qualitative_llm" | "not_compared";

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  comparison_rule: ComparisonRule;
  description?: string;
  unit?: string | null;
  industry_presets?: string[];
  custom?: boolean;
}
export interface Evidence { source_id: string; quote: string; start_char: number; end_char: number; verified: boolean }
export interface Cell {
  field_id: string;
  entity_id: string;
  value: string | number | string[] | null;
  display_value: string;
  status: Status;
  evidence: Evidence[];
  confidence: number;
  note: string;
}
export interface Verdict { field_id: string; entity_id: string; verdict: VerdictKind; rationale: string; method: "rule" | "llm"; confidence?: number | null }
export interface Entity { id: string; name: string; is_your_company: boolean; source_id: string }
export type SourceKind = "notes" | "public" | "internal";
export interface Source { source_id: string; entity_id: string; text: string; title: string; kind: SourceKind; captured_at: string; outdated: boolean }
export interface Comparison {
  id: string;
  meta: Record<string, unknown>;
  entities: Entity[];
  sources: Source[];
  fields: FieldDefinition[];
  cells: Cell[];
  verdicts: Verdict[];
}
export interface VerificationReport { checked_cells: number; downgraded_cells: number; unverified_quotes: number; notes: string[] }
export interface CompareResponse { comparison: Comparison; verification_report: VerificationReport; partial?: boolean }
export interface Objection { field_id: string; objection: string; response: string }
export interface Battlecard { entity_id: string; objections: Objection[]; generated_at: string }
export interface EntityInput { name: string; text: string; kind: SourceKind; captured_at: string | null }
export interface CompareRequest { your_company: EntityInput; competitors: EntityInput[]; industry: string; custom_fields: FieldDefinition[] }
export type Stage = "segment" | "schema" | "extract" | "verify" | "judge" | "done" | "error";
export const STAGES: [Stage, string][] = [
  ["segment", "Segmenting notes"],
  ["schema", "Selecting fields"],
  ["extract", "Extracting evidence (model)"],
  ["verify", "Verifying quotes against the notes"],
  ["judge", "Judging win / lose / tie"],
  ["done", "Rendering table"],
];
