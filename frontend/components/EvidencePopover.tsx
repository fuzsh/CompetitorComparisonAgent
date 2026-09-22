"use client";
import { useState } from "react";
import Corners from "./Corners";
import { StatusBadge, VERDICT_LABEL } from "./ComparisonTable";
import { patchCell, patchSource } from "@/lib/api";
import { KIND_LABEL, fmtDate, freshness, levelClass } from "@/lib/freshness";
import type { Cell, Comparison, Entity, FieldDefinition, Source, Status, Verdict } from "@/lib/types";

/** "Where does this come from?" — the cell's value, its verdict, and the dated source block(s) with verbatim quotes. */
export default function EvidencePopover({
  entity, field, cell, source, verdict, comparisonId, editable, onClose, onUpdated,
}: {
  entity: Entity; field: FieldDefinition; cell: Cell; source: Source; verdict?: Verdict;
  comparisonId: string; editable: boolean; onClose: () => void; onUpdated: (c: Comparison) => void;
}) {
  const [value, setValue] = useState(cell.display_value);
  const [status, setStatus] = useState<Status>(cell.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const quotes = [...cell.evidence].filter((e) => e.verified).sort((a, b) => a.start_char - b.start_char);
  const fresh = freshness(source);
  const missing = cell.status === "missing";
  const bucket = cell.confidence >= 0.75 ? "high" : cell.confidence >= 0.5 ? "medium" : "low";
  const verdictText = entity.is_your_company
    ? "Anchor column — every competitor verdict is computed against this value."
    : field.comparison_rule === "not_compared"
      ? "This row is context only — no win / lose is claimed."
      : verdict ? `${VERDICT_LABEL[verdict.verdict]} — ${verdict.rationale} (${verdict.method})` : "Verdict not computed yet.";

  const parts: { text: string; mark: boolean }[] = [];
  let pos = 0;
  for (const q of quotes) {
    if (q.start_char < pos) continue;
    parts.push({ text: source.text.slice(pos, q.start_char), mark: false }, { text: source.text.slice(q.start_char, q.end_char), mark: true });
    pos = q.end_char;
  }
  parts.push({ text: source.text.slice(pos), mark: false });

  const call = async (fn: () => Promise<Comparison>) => {
    setBusy(true); setErr("");
    try { onUpdated(await fn()); } catch (e) { setErr(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };
  const today = () => new Date().toISOString().slice(0, 10);

  return (
    <aside className="popover blueprint" role="dialog" aria-label="Where does this come from?">
      <Corners />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 17, lineHeight: 1.15 }}>Where does this come from?</div>
          <div className="muted" style={{ fontSize: 12 }}>{entity.name} · {field.label}</div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close" style={{ fontSize: 14, padding: "0 6px" }}>✕</button>
      </div>

      <p style={{ margin: "8px 0 2px", fontSize: 14 }}>{missing ? "— not stated in the notes" : cell.display_value} <StatusBadge status={cell.status} /></p>
      <p className="muted" style={{ margin: "0 0 8px", fontSize: 11 }}>
        {missing ? "No sentence in these notes mentions this field. Left blank rather than guessed." : `Confidence ${bucket} (${Math.round(cell.confidence * 100)}%)${cell.note ? ` · ${cell.note}` : ""}`}
      </p>
      <div style={{ padding: "8px 10px", background: "color-mix(in srgb, var(--color-accent) 9%, transparent)", fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>{verdictText}</div>

      <div className="blueprint" style={{ padding: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className={`tag-kind tag-kind-${source.kind}`}>{KIND_LABEL[source.kind]}</span>
          <span className={levelClass[fresh.level]} style={{ fontSize: 11 }}>● Captured {fmtDate(source.captured_at)} · {fresh.label} old</span>
        </div>
        <div style={{ fontWeight: 500, fontSize: 13, marginTop: 6 }}>{source.title || `${entity.name} notes`}</div>
        {quotes.length > 0
          ? quotes.map((q, i) => <div key={i} className="quote-box">“{q.quote}”</div>)
          : <div className="quote-box muted">No supporting text found in these notes.</div>}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, marginTop: 6, padding: "2px 6px" }} onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? "Hide full notes" : "Show full notes with highlights"}
        </button>
        {showNotes && (
          <div className="source-box" style={{ marginTop: 6 }}>
            {parts.map((p, i) => (p.mark ? <span key={i} className="quote-mark">{p.text}</span> : <span key={i}>{p.text}</span>))}
          </div>
        )}
      </div>

      {editable && (
        <>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy || source.outdated}
              onClick={() => call(() => patchSource(comparisonId, { source_id: source.source_id, outdated: true }))}>Mark as outdated</button>
            <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={busy}
              onClick={() => call(() => patchSource(comparisonId, { source_id: source.source_id, outdated: false, captured_at: today() }))}>Confirm still valid</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); call(() => patchCell(comparisonId, { field_id: field.id, entity_id: entity.id, value: status === "missing" ? null : value, status })); }}
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} disabled={status === "missing"} aria-label="Cell value"
              placeholder={field.type === "price" ? "e.g. $10/month" : "value"} style={{ flex: "1 1 120px", fontSize: 13 }} />
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Cell status" style={{ width: "auto", fontSize: 12 }}>
              <option value="stated">stated</option><option value="inferred">inferred</option><option value="missing">missing</option>
            </select>
            <button type="submit" className="btn btn-secondary" disabled={busy} style={{ fontSize: 12 }}>{busy ? "Working…" : "Save & re-judge"}</button>
          </form>
        </>
      )}
      {err && <p className="bad" style={{ margin: "6px 0 0", fontSize: 11 }}>{err}</p>}
    </aside>
  );
}
