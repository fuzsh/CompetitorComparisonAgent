"use client";
import { useState } from "react";
import Corners from "./Corners";
import SourceCard from "./SourceCard";
import TemplatePicker from "./TemplatePicker";
import { fmtDate, freshness, kindLabel, kindOf, levelClass } from "@/lib/freshness";
import type { EntityInput, FieldDefinition, Source } from "@/lib/types";

const CONNECTORS: [string, string][] = [
  ["HubSpot", "Call notes, emails, support tickets mentioning a competitor"],
  ["Confluence", "Competitor pages, launch briefs, price lists"],
  ["Web monitor", "Competitor websites and pricing pages, weekly"],
  ["Slack", "#competitors channel"],
  ["Google Drive", "Sales decks, market reports"],
  ["News and social", "Press releases, LinkedIn, trade media"],
];
const empty = (): EntityInput => ({ name: "", text: "", kind: "notes", captured_at: null });

export default function SourcesTab({
  you, comps, onYou, onComps, sources, names, rows, industry, industries, coreCount, presetCount, onIndustry, custom, onCustom, onRun, runLabel, canRun, running,
}: {
  you: EntityInput; comps: EntityInput[]; onYou: (v: EntityInput) => void; onComps: (v: EntityInput[]) => void;
  sources: Source[]; names: Record<string, string>; rows: number;
  industry: string; industries: string[]; coreCount: number; presetCount: number; onIndustry: (v: string) => void;
  custom: FieldDefinition[]; onCustom: (v: FieldDefinition[]) => void;
  onRun: () => void; runLabel: string; canRun: boolean; running: boolean;
}) {
  const [onlyStale, setOnlyStale] = useState(false);
  const register = sources.map((s) => ({ s, fresh: freshness(s) }));
  const staleCount = register.filter((r) => r.fresh.level === "stale").length;
  const shown = onlyStale ? register.filter((r) => r.fresh.level === "stale") : register;
  const view = (entityId: string) => document.getElementById(`src-card-${entityId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="two-col">
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <div className="blueprint" style={{ padding: 0, overflowX: "auto" }}>
          <Corners />
          <div className="section-head" style={{ justifyContent: "space-between" }}>
            <h5>Source register</h5>
            <span className="muted" style={{ fontSize: 12 }}>{sources.length} source{sources.length === 1 ? "" : "s"} · {staleCount} need{staleCount === 1 ? "s" : ""} a refresh</span>
          </div>
          <table className="table register" style={{ minWidth: 560 }}>
            <thead><tr><th>Source</th><th>Company</th><th>Type</th><th>Captured</th><th>Freshness</th><th /></tr></thead>
            <tbody>
              {shown.map(({ s, fresh }) => (
                <tr key={s.source_id}>
                  <td>{s.title || `${names[s.entity_id]} notes`}</td>
                  <td>{names[s.entity_id]}</td>
                  <td><span className={`tag-kind tag-kind-${kindOf(s.kind)}`}>{kindLabel(s.kind)}</span></td>
                  <td>{fmtDate(s.captured_at)}</td>
                  <td className={levelClass[fresh.level]}>{fresh.label}</td>
                  <td><button type="button" className="btn btn-ghost" style={{ fontSize: 12, padding: "0 4px" }} onClick={() => view(s.entity_id)}>View</button></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={6} className="muted">Nothing stale.</td></tr>}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, padding: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} aria-pressed={onlyStale} onClick={() => setOnlyStale((v) => !v)}>{onlyStale ? "Show all" : "Show only stale"}</button>
          </div>
        </div>

        <div className="blueprint" style={{ padding: 14 }}>
          <Corners />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
            <h5 style={{ margin: 0 }}>Add notes by hand</h5>
            <span className="muted" style={{ fontSize: 12 }}>Anyone can paste. Tag each block with its type and capture date so freshness is real.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <SourceCard id="src-card-you" kicker="Your company" anchor value={you} rows={rows} onChange={onYou} />
            {comps.map((c, i) => (
              <SourceCard key={i} id={`src-card-c${i + 1}`} kicker={`Competitor ${i + 1}`} value={c} rows={rows}
                onChange={(v) => onComps(comps.map((x, j) => (j === i ? v : x)))} onRemove={comps.length > 1 ? () => onComps(comps.filter((_, j) => j !== i)) : undefined} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={comps.length >= 3} onClick={() => onComps([...comps, empty()])}>+ Add competitor</button>
            <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>3 max, so the table stays readable</span>
          </div>
        </div>

        <div className="blueprint" style={{ padding: 14 }}>
          <Corners />
          <TemplatePicker industry={industry} industries={industries} coreCount={coreCount} presetCount={presetCount} onIndustry={onIndustry} customFields={custom} onCustomFields={onCustom} />
        </div>

        <button type="button" className="btn btn-primary blueprint" onClick={onRun} disabled={running || !canRun} style={{ justifyContent: "center", padding: 12, fontSize: 16, letterSpacing: "0.02em" }}>
          <Corners />{runLabel}
        </button>
        {!canRun && !running && <p className="muted" style={{ margin: "-8px 0 0", fontSize: 11 }}>Add notes for your company and every competitor to enable generation.</p>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="blueprint" style={{ padding: 14 }}>
          <Corners />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h5 style={{ margin: 0 }}>Connected data sources <span className="tag-idea" style={{ marginLeft: 6 }}>idea</span></h5>
            <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled title="Concept only — not implemented in this prototype">+ Connect source</button>
          </div>
          <p className="muted" style={{ margin: "6px 0 10px", fontSize: 12 }}>
            Concept: pulled in through connectors, each sync creating dated source blocks. Nothing would be copied into the tables without a quote. Not built here — paste notes by hand on the left.
          </p>
          {CONNECTORS.map(([name, desc]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div><div className="muted" style={{ fontSize: 11 }}>{desc}</div></div>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 11 }} disabled title="Concept only — not implemented in this prototype">Connect</button>
            </div>
          ))}
        </div>

        <div className="blueprint" style={{ padding: 14 }}>
          <Corners />
          <h5 style={{ margin: "0 0 8px" }}>Freshness rules</h5>
          {([["Fresh", "under 30 days", "ok"], ["Aging", "30 to 90 days, shown with a note", "warn"], ["Stale", "over 90 days or marked outdated, flagged in the tables", "bad"]] as const).map(([k, v, cls]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "3px 0" }}><span className={cls}>{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>
          ))}
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 11 }}>Cells from stale sources carry a “stale source” tag in every table until someone opens the evidence and confirms the source is still valid.</p>
        </div>
      </div>
    </div>
  );
}
