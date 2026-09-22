"use client";
import Corners from "./Corners";
import type { Cell, FieldDefinition, Verdict, VerificationReport } from "@/lib/types";

export default function StatsBar({
  cells, verdicts, fields, report, showValues, showVerdicts, total,
}: { cells: Cell[]; verdicts: Verdict[]; fields: FieldDefinition[]; report: VerificationReport | null; showValues: boolean; showVerdicts: boolean; total: number }) {
  const count = (f: (c: Cell) => boolean) => (showValues ? cells.filter(f).length : 0);
  const nStated = count((c) => c.status === "stated");
  const nInferred = count((c) => c.status === "inferred");
  const nMissing = count((c) => c.status === "missing");
  const informational = new Set(fields.filter((f) => f.comparison_rule === "not_compared").map((f) => f.id));
  const vs = showVerdicts ? verdicts.filter((v) => !informational.has(v.field_id)) : [];
  const n = (k: Verdict["verdict"]) => vs.filter((v) => v.verdict === k).length;
  const pct = (x: number) => (total ? Math.round((x / total) * 100) : 0);
  const receipt = !showValues
    ? "Nothing checked yet. Quotes are verified as literal substrings of your notes before any cell is shown."
    : report
      ? `${report.checked_cells} cells checked · ${report.downgraded_cells} downgraded · ${report.unverified_quotes} quotes rejected.${report.notes.length ? " Downgrades are listed under the table." : ""}`
      : "Verifying quotes against the notes…";

  return (
    <div className="blueprint" style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "16px 20px", alignItems: "start" }}>
      <Corners />
      <div>
        <div className="kicker" style={{ marginBottom: 6 }}>Evidence mix — {total} cells</div>
        <div style={{ display: "flex", height: 10, gap: 2 }}>
          <span style={{ background: "var(--color-accent)", width: `${pct(nStated)}%`, display: "block" }} />
          <span className="hatch" style={{ border: "1px solid var(--color-accent)", width: `${pct(nInferred)}%`, display: "block" }} />
          <span style={{ border: "1px dashed color-mix(in srgb, var(--color-text) 35%, transparent)", width: `${pct(nMissing)}%`, display: "block" }} />
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11 }}>
          <span><b>{nStated}</b> stated</span>
          <span><b>{nInferred}</b> inferred</span>
          <span><b>{nMissing}</b> missing</span>
        </div>
      </div>
      <div>
        <div className="kicker" style={{ marginBottom: 6 }}>Verdict against you</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "baseline" }}>
          <span className="stat-num" style={{ color: "var(--color-accent-800)" }}>{n("win")}<span className="stat-unit">win</span></span>
          <span className="stat-num">{n("lose")}<span className="stat-unit">lose</span></span>
          <span className="stat-num">{n("tie")}<span className="stat-unit">even</span></span>
          <span className="stat-num" style={{ color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>{n("n/a")}<span className="stat-unit">no data</span></span>
        </div>
      </div>
      <div>
        <div className="kicker" style={{ marginBottom: 6 }}>Verification receipt</div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{receipt}</p>
      </div>
    </div>
  );
}
