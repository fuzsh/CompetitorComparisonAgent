"use client";
import type { ReactNode } from "react";
import Corners from "./Corners";
import { StatusBadge, VerdictBadge, type Sel } from "./ComparisonTable";
import { staleEntities } from "@/lib/freshness";
import type { Cell, Entity, FieldDefinition, Source, Verdict } from "@/lib/types";

const TEXT = new Set(["free_text", "categorical", "list"]);
const trim = (s: string, n = 64) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export default function OverviewTab({
  fields, entities, cells, verdicts, sources, selected, onSelect,
}: { fields: FieldDefinition[]; entities: Entity[]; cells: Cell[]; verdicts: Verdict[]; sources: Source[]; selected: Sel | null; onSelect: (s: Sel) => void }) {
  const you = entities.find((e) => e.is_your_company)!;
  const cols = [you, ...entities.filter((e) => !e.is_your_company)];
  const cellMap = new Map(cells.map((c) => [`${c.entity_id}|${c.field_id}`, c]));
  const verdictMap = new Map(verdicts.map((v) => [`${v.entity_id}|${v.field_id}`, v]));
  const stale = staleEntities(sources);
  const staleTag = (e: Entity, c?: Cell) => (c && c.status !== "missing" && stale.has(e.id) ? <> <span className="tag-stale">stale source</span></> : null);

  const renderText = (f: FieldDefinition, e: Entity) => {
    const c = cellMap.get(`${e.id}|${f.id}`);
    if (!c || c.status === "missing") return <span className="muted">–</span>;
    return <><span style={c.status === "inferred" ? { fontStyle: "italic" } : undefined}>{c.display_value}</span>{c.status === "inferred" && <> <StatusBadge status="inferred" /></>}{staleTag(e, c)}</>;
  };
  const renderFeature = (f: FieldDefinition, e: Entity) => {
    const c = cellMap.get(`${e.id}|${f.id}`);
    if (f.type !== "boolean") {
      if (!c || c.status === "missing") return <span className="muted">–</span>;
      return <><em>{c.display_value}</em>{c.status === "inferred" && <> <StatusBadge status="inferred" /></>}{staleTag(e, c)}</>;
    }
    if (!c || c.status === "missing") return <span className="icon icon-none" aria-label="not in the notes">–</span>;
    const yes = c.display_value === "Yes";
    const quote = c.evidence[0]?.quote ?? "";
    if (c.status === "inferred") return <><span className="icon icon-warn" aria-label="inferred">~</span><span className="muted" style={{ fontSize: 12 }}>{yes ? "likely yes" : "likely no"} · inferred</span>{staleTag(e, c)}</>;
    return <><span className={`icon ${yes ? "icon-ok" : "icon-bad"}`} aria-label={yes ? "yes" : "no"}>{yes ? "✓" : "✗"}</span><span className="muted" style={{ fontSize: 12 }}>{trim(quote)}</span>{staleTag(e, c)}</>;
  };
  const renderPrice = (f: FieldDefinition, e: Entity) => {
    const c = cellMap.get(`${e.id}|${f.id}`);
    if (!c || c.status === "missing") return <span className="muted">–</span>;
    const v = !e.is_your_company && f.comparison_rule !== "not_compared" ? verdictMap.get(`${e.id}|${f.id}`) : undefined;
    return <><span style={c.status === "inferred" ? { fontStyle: "italic" } : undefined}>{c.display_value}</span>{c.status === "inferred" && <> <StatusBadge status="inferred" /></>}{v && <> <VerdictBadge verdict={v.verdict} /></>}{staleTag(e, c)}</>;
  };

  const groups: { title: string; sub: string; rows: FieldDefinition[]; render: (f: FieldDefinition, e: Entity) => ReactNode }[] = [
    { title: "Company overview", sub: "The basics, side by side", rows: fields.filter((f) => TEXT.has(f.type) && f.id !== "notable_weakness"), render: renderText },
    { title: "Key competitive features", sub: "Green is stated yes, red is stated no, amber is inferred, dash is not in the notes", rows: fields.filter((f) => f.type === "boolean" || f.id === "notable_weakness"), render: renderFeature },
    { title: "Pricing & numbers", sub: "As found in the notes, normalized per month where possible; verdicts are from your point of view", rows: fields.filter((f) => f.type === "price" || f.type === "number"), render: renderPrice },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.filter((g) => g.rows.length).map((g) => (
        <div key={g.title} className="blueprint" style={{ padding: 0, overflowX: "auto" }}>
          <Corners />
          <div className="section-head"><h5>{g.title}</h5><span className="muted" style={{ fontSize: 12 }}>{g.sub}</span></div>
          <table className="table ov-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ width: 180 }} />
                {cols.map((e) => <th key={e.id} className={e.is_your_company ? "col-you" : undefined}>{e.name}{e.is_your_company ? " — you" : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((f) => (
                <tr key={f.id}>
                  <th scope="row" className="rowhead">{f.label}{f.custom && <span className="kicker" style={{ marginLeft: 6 }}>custom</span>}</th>
                  {cols.map((e) => {
                    const isSel = selected?.entityId === e.id && selected?.fieldId === f.id;
                    return <td key={e.id} className={`${e.is_your_company ? "you" : ""} ${isSel ? "cell-selected" : ""}`} onClick={() => onSelect({ entityId: e.id, fieldId: f.id })}>{g.render(f, e)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
