"use client";
import { useState } from "react";
import Corners from "./Corners";
import { VERDICT_LABEL } from "./ComparisonTable";
import { patchCell } from "@/lib/api";
import type { Cell, Comparison, Entity, FieldDefinition, Source, Status, Verdict } from "@/lib/types";

export default function EvidencePopover({
  entity, field, cell, source, verdict, comparisonId, editable, onClose, onUpdated,
}: {
  entity: Entity; field: FieldDefinition; cell: Cell; source: Source; verdict?: Verdict;
  comparisonId: string; editable: boolean; onClose: () => void; onUpdated: (c: Comparison) => void;
}) {
  const [value, setValue] = useState(cell.display_value);
  const [status, setStatus] = useState<Status>(cell.status);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const spans = [...cell.evidence].filter((e) => e.verified).sort((a, b) => a.start_char - b.start_char);
  const parts: { text: string; mark: boolean }[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start_char < pos) continue;
    parts.push({ text: source.text.slice(pos, s.start_char), mark: false }, { text: source.text.slice(s.start_char, s.end_char), mark: true });
    pos = s.end_char;
  }
  parts.push({ text: source.text.slice(pos), mark: false });

  const missing = cell.status === "missing";
  const bucket = cell.confidence >= 0.75 ? "high" : cell.confidence >= 0.5 ? "medium" : "low";
  const verdictText = entity.is_your_company
    ? "Anchor column — every competitor verdict is computed against this value."
    : field.comparison_rule === "not_compared"
      ? "This row is context only — no win / lose is claimed."
      : verdict
        ? `${VERDICT_LABEL[verdict.verdict]} — ${verdict.rationale} (${verdict.method})`
        : "Verdict not computed yet.";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      onUpdated(await patchCell(comparisonId, { field_id: field.id, entity_id: entity.id, value: status === "missing" ? null : value, status }));
    } catch (ex) {
      setErr(String((ex as Error).message ?? ex));
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside style={{ minWidth: 0 }}>
      <div className="blueprint" style={{ padding: 14, position: "sticky", top: 16 }}>
        <Corners />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div>
            <div className="kicker kicker-accent">Evidence</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19, lineHeight: 1.15 }}>{entity.name} · {field.label}</div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close evidence panel" style={{ fontSize: 14, padding: "0 6px" }}>✕</button>
        </div>
        <p style={{ margin: "0 0 4px", fontSize: 14 }}>{missing ? "— not stated in the notes" : cell.display_value}</p>
        <p className="muted" style={{ margin: "0 0 10px", fontSize: 11 }}>
          {missing ? "No sentence in these notes mentions this field. Left blank rather than guessed." : `Confidence ${bucket} (${Math.round(cell.confidence * 100)}%)${cell.note ? ` · ${cell.note}` : ""}`}
        </p>
        <div style={{ padding: "9px 11px", background: "color-mix(in srgb, var(--color-accent) 9%, transparent)", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{verdictText}</div>
        <div className="kicker" style={{ marginBottom: 5 }}>Traced to source notes</div>
        <div className="source-box" style={spans.length ? undefined : { color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          {parts.map((p, i) => (p.mark ? <span key={i} className="quote-mark">{p.text}</span> : <span key={i}>{p.text}</span>))}
        </div>
        {editable && (
          <form onSubmit={save} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" }}>
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} disabled={status === "missing"} aria-label="Cell value"
              placeholder={field.type === "price" ? "e.g. $10/month" : "value"} style={{ flex: "1 1 120px", fontSize: 13 }} />
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Cell status" style={{ width: "auto", fontSize: 12 }}>
              <option value="stated">stated</option>
              <option value="inferred">inferred</option>
              <option value="missing">missing</option>
            </select>
            <button type="submit" className="btn btn-secondary" disabled={saving} style={{ fontSize: 12 }}>{saving ? "Re-judging…" : "Save & re-judge"}</button>
            {err && <span style={{ fontSize: 11, color: "#b3261e" }}>{err}</span>}
          </form>
        )}
      </div>
    </aside>
  );
}
