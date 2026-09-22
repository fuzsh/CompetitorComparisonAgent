"use client";
import Corners from "./Corners";
import type { EntityInput } from "@/lib/types";

/** Same split as backend/text.py::sentences, used only for the meter hint. */
export const sentenceCount = (text: string) => (text.match(/[^.!?\n]+[.!?]*/g) ?? []).filter((s) => s.trim()).length;

export default function SourceCard({
  kicker, anchor = false, value, rows, onChange, onRemove,
}: { kicker: string; anchor?: boolean; value: EntityInput; rows: number; onChange: (v: EntityInput) => void; onRemove?: () => void }) {
  const n = sentenceCount(value.text);
  const likely = Math.min(rows, Math.round(n * 1.4)); // ponytail: naive heuristic; the pipeline decides what actually fills
  const hint = n === 0 ? "paste notes to begin" : n === 1 ? "1 sentence · thin — expect gaps" : `${n} sentences · likely fills ${likely} of ${rows} rows`;
  const bg = anchor ? { background: "var(--color-bg)" } : undefined;

  return (
    <div className="blueprint" style={{ padding: 12, background: anchor ? "color-mix(in srgb, var(--color-accent) 7%, transparent)" : undefined }}>
      <Corners />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span className={`kicker ${anchor ? "kicker-accent" : ""}`}>{kicker}</span>
        {anchor ? (
          <span className="kicker">anchor column</span>
        ) : (
          onRemove && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={onRemove}>
              Remove
            </button>
          )
        )}
      </div>
      <input
        className="input"
        placeholder={anchor ? "Your company name" : `Name (optional, defaults to "${kicker}")`}
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        style={{ marginBottom: 8, ...bg }}
      />
      <textarea
        className="input"
        required
        placeholder={anchor ? "What you offer, pricing, features, who it's for…" : "Website copy, call notes, a rough impression…"}
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        style={{ minHeight: 84, fontSize: 13, ...bg }}
      />
      <div className="muted" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11 }}>
        <span className="meter"><span style={{ width: `${rows ? (likely / rows) * 100 : 0}%` }} /></span>
        {hint}
      </div>
    </div>
  );
}
