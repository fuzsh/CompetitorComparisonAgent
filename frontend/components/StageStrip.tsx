"use client";
import Corners from "./Corners";

const LABELS = ["Segmenting notes", "Selecting rows", "Extracting evidence", "Verifying quotes", "Judging win / lose", "Rendering"];

/** `stage` = number of pipeline stages already completed (0..6). */
export default function StageStrip({ stage, onStop }: { stage: number; onStop: () => void }) {
  return (
    <div className="blueprint" style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
      <Corners />
      {LABELS.map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12,
          color: i < stage ? "var(--color-accent-800)" : i === stage ? "var(--color-text)" : "color-mix(in srgb, var(--color-text) 40%, transparent)" }}>
          <span style={{ width: 9, height: 9, border: "1px solid currentColor", background: i < stage ? "var(--color-accent)" : "transparent", display: "inline-block" }} />
          {label}
        </div>
      ))}
      <button type="button" className="btn btn-secondary" style={{ fontSize: 12, marginLeft: "auto" }} onClick={onStop}>Stop, keep partial</button>
    </div>
  );
}
