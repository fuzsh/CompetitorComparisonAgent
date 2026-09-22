"use client";
import Corners from "./Corners";
import type { EntityInput, SourceKind } from "@/lib/types";

/** Same split as backend/text.py::sentences, used only for the meter hint. */
export const sentenceCount = (text: string) => (text.match(/[^.!?\n]+[.!?]*/g) ?? []).filter((s) => s.trim()).length;

export default function SourceCard({
  id, kicker, anchor = false, value, rows, onChange, onRemove,
}: { id?: string; kicker: string; anchor?: boolean; value: EntityInput; rows: number; onChange: (v: EntityInput) => void; onRemove?: () => void }) {
  const n = sentenceCount(value.text);
  const likely = Math.min(rows, Math.round(n * 1.4)); // ponytail: naive heuristic; the pipeline decides what actually fills
  const hint = n === 0 ? "paste notes to begin" : n === 1 ? "1 sentence · thin — expect gaps" : `${n} sentences · likely fills ${likely} of ${rows} rows`;
  const bg = anchor ? { background: "var(--color-bg)" } : undefined;
  const small = { width: "auto", fontSize: 12, minHeight: 30, padding: "3px 8px", ...bg } as const;

  return (
    <div id={id} className="blueprint" style={{ padding: 12, background: anchor ? "color-mix(in srgb, var(--color-accent) 7%, transparent)" : undefined }}>
      <Corners />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className={`kicker ${anchor ? "kicker-accent" : ""}`}>{kicker}</span>
        {anchor ? <span className="kicker">anchor column</span> : onRemove && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={onRemove}>Remove</button>
        )}
      </div>
      <input className="input" placeholder={anchor ? "Your company name" : `Name (optional, defaults to "${kicker}")`} value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })} style={{ marginBottom: 8, ...bg }} />
      <textarea className="input" required value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder={anchor ? "What you offer, pricing, features, who it's for…" : "Website copy, call notes, a rough impression…"} style={{ minHeight: 84, fontSize: 13, ...bg }} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
        <select className="input" aria-label="Source type" value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as SourceKind })} style={small}>
          <option value="notes">Notes</option>
          <option value="public">Public</option>
          <option value="internal">Internal</option>
        </select>
        <label className="muted" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
          captured
          <input className="input" type="date" aria-label="Capture date" value={value.captured_at ?? ""} onChange={(e) => onChange({ ...value, captured_at: e.target.value || null })} style={small} />
          {!value.captured_at && <span>(today)</span>}
        </label>
      </div>
      <div className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11 }}>
        <span className="meter"><span style={{ width: `${rows ? (likely / rows) * 100 : 0}%` }} /></span>
        {hint}
      </div>
    </div>
  );
}
