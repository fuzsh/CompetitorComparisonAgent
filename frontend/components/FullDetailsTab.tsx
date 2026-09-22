"use client";
import ComparisonTable, { type Sel } from "./ComparisonTable";
import StatsBar from "./StatsBar";
import { staleEntities } from "@/lib/freshness";
import type { Cell, Entity, FieldDefinition, Source, Verdict, VerificationReport } from "@/lib/types";

export default function FullDetailsTab({
  fields, entities, cells, verdicts, sources, report, showValues, showVerdicts, selected, onSelect,
}: {
  fields: FieldDefinition[]; entities: Entity[]; cells: Cell[] | null; verdicts: Verdict[]; sources: Source[]; report: VerificationReport | null;
  showValues: boolean; showVerdicts: boolean; selected: Sel | null; onSelect: (s: Sel) => void;
}) {
  const sw = (style: React.CSSProperties, cls = "") => <span className={cls} style={{ width: 16, height: 10, display: "inline-block", ...style }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatsBar cells={cells ?? []} verdicts={verdicts} fields={fields} report={report} showValues={showValues} showVerdicts={showVerdicts} total={fields.length * entities.length} />
      <ComparisonTable fields={fields} entities={entities} cells={cells} verdicts={verdicts} showVerdicts={showVerdicts} selected={selected} onSelect={onSelect} stale={staleEntities(sources)} />
      <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", fontSize: 11 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{sw({ background: "color-mix(in srgb, var(--color-accent) 22%, transparent)", border: "1px solid var(--color-accent)" })} you win this row</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{sw({ background: "color-mix(in srgb, var(--color-text) 12%, transparent)" })} you lose</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{sw({ border: "1px solid color-mix(in srgb, var(--color-text) 25%, transparent)" })} even</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{sw({ border: "1px dashed color-mix(in srgb, var(--color-text) 30%, transparent)" }, "hatch")} not enough data — never guessed</span>
        <span style={{ marginLeft: "auto" }}>Click any cell to see the sentence it came from.</span>
      </div>
      {report && report.notes.length > 0 && (
        <details className="muted" style={{ fontSize: 12 }}>
          <summary style={{ cursor: "pointer" }}>Verification notes ({report.notes.length})</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{report.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
