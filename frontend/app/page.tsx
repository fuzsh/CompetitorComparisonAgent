"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import ComparisonTable, { type Sel } from "@/components/ComparisonTable";
import Corners from "@/components/Corners";
import EvidencePopover from "@/components/EvidencePopover";
import ExportBar from "@/components/ExportBar";
import SourceCard from "@/components/SourceCard";
import StageStrip from "@/components/StageStrip";
import StatsBar from "@/components/StatsBar";
import TemplatePicker, { prettyIndustry } from "@/components/TemplatePicker";
import ThemeToggle from "@/components/ThemeToggle";
import { API, getExamples, getHealth, getPresets, streamComparison } from "@/lib/api";
import type { Cell, CompareRequest, CompareResponse, Comparison, Entity, EntityInput, FieldDefinition, Source, Verdict, VerificationReport } from "@/lib/types";

const empty = (): EntityInput => ({ name: "", text: "" });
const STAGE_INDEX: Record<string, number> = { segment: 1, schema: 2, extract: 3, verify: 4, judge: 5, done: 6 };
const SAVED = "comparison";
type Phase = "empty" | "running" | "done";
type Live = { entities?: Entity[]; sources?: Source[]; fields?: FieldDefinition[]; cells?: Cell[]; verdicts?: Verdict[]; report?: VerificationReport };

export default function Workspace() {
  // ── inputs ──
  const [you, setYou] = useState<EntityInput>(empty());
  const [comps, setComps] = useState<EntityInput[]>([empty(), empty()]);
  const [industry, setIndustry] = useState("saas");
  const [custom, setCustom] = useState<FieldDefinition[]>([]);
  const [presets, setPresets] = useState<{ industries: string[]; fields: Record<string, FieldDefinition[]>; core: FieldDefinition[] }>({ industries: ["generic", "saas"], fields: {}, core: [] });
  const [examples, setExamples] = useState<Record<string, CompareRequest>>({});
  const [health, setHealth] = useState<Record<string, string | boolean> | null>(null);
  // ── run ──
  const [phase, setPhase] = useState<Phase>("empty");
  const [stage, setStage] = useState(0);
  const [live, setLive] = useState<Live>({});
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Sel | null>(null);
  const abort = useRef<AbortController | null>(null);
  const liveRef = useRef<Live>({});

  useEffect(() => {
    getPresets().then((p) => setPresets({ industries: Object.keys(p.industries), fields: p.fields, core: p.core_fields }))
      .catch(() => setError(`Backend not reachable at ${API}. Start it with: python main.py`));
    getExamples().then(setExamples).catch(() => {});
    getHealth().then(setHealth).catch(() => {});
    try {
      const raw = sessionStorage.getItem(SAVED);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore client-only storage after hydration
      if (raw) { setResult(JSON.parse(raw) as CompareResponse); setPhase("done"); }
    } catch {}
  }, []);

  // What the table shows: finished result > live stream > the form itself (skeleton rows).
  const formFields = useMemo(() => {
    const seen = new Set<string>();
    return [...presets.core, ...(presets.fields[industry] ?? []), ...custom].filter((f) => !seen.has(f.id) && !!seen.add(f.id));
  }, [presets, industry, custom]);
  const formEntities = useMemo<Entity[]>(() => [
    { id: "you", name: you.name.trim() || "Your company", is_your_company: true, source_id: "src_you" },
    ...comps.map((c, i) => ({ id: `c${i + 1}`, name: c.name.trim() || `Competitor ${i + 1}`, is_your_company: false, source_id: `src_c${i + 1}` })),
  ], [you.name, comps]);
  const formSources = useMemo<Source[]>(() => [
    { source_id: "src_you", entity_id: "you", text: you.text },
    ...comps.map((c, i) => ({ source_id: `src_c${i + 1}`, entity_id: `c${i + 1}`, text: c.text })),
  ], [you.text, comps]);

  const comparison = result?.comparison;
  const fields = comparison?.fields ?? live.fields ?? formFields;
  const entities = comparison?.entities ?? live.entities ?? formEntities;
  const sources = comparison?.sources ?? live.sources ?? formSources;
  const cells = comparison?.cells ?? live.cells ?? null;
  const verdictList = comparison?.verdicts ?? live.verdicts;
  const verdicts = verdictList ?? [];
  const report = result?.verification_report ?? live.report ?? null;
  const showValues = cells !== null;
  const showVerdicts = verdictList !== undefined;
  const partial = phase === "done" && !!result?.partial;
  const done = phase === "done" && !!result && !result.partial;
  const compCount = Math.max(entities.length - 1, 0);
  const subhead = !showValues
    ? `${prettyIndustry(industry)} preset · ${fields.length} rows ready. Nothing runs until you press generate.`
    : phase === "running"
      ? "Filling in… values appear only once a quote backs them."
      : partial
        ? "Partial result — stopped before verdicts. Every value shown is quoted or labelled; nothing was guessed."
        : "Every value below is either quoted from your notes, labelled as an inference, or left blank on purpose.";

  const persist = (r: CompareResponse | null) => {
    try {
      if (r) sessionStorage.setItem(SAVED, JSON.stringify(r));
      else sessionStorage.removeItem(SAVED);
    } catch {}
  };
  const partialResult = (): CompareResponse => {
    const p = liveRef.current;
    return {
      comparison: { id: "partial", meta: {}, entities: p.entities ?? formEntities, sources: p.sources ?? formSources, fields: p.fields ?? formFields, cells: p.cells ?? [], verdicts: p.verdicts ?? [] },
      verification_report: p.report ?? { checked_cells: 0, downgraded_cells: 0, unverified_quotes: 0, notes: [] },
      partial: true,
    };
  };

  const run = async () => {
    setError(""); setResult(null); setSelected(null); setLive({}); liveRef.current = {}; setStage(0); setPhase("running"); persist(null);
    abort.current = new AbortController();
    const req: CompareRequest = { your_company: you, competitors: comps, industry, custom_fields: custom };
    try {
      await streamComparison(req, (s, payload) => {
        const p = liveRef.current;
        if (s === "segment") { p.entities = payload.entities as Entity[]; p.sources = payload.sources as Source[]; }
        else if (s === "schema") p.fields = payload.fields as FieldDefinition[];
        else if (s === "extract" || s === "verify") { p.cells = payload.cells as Cell[]; if (s === "verify") p.report = payload as unknown as VerificationReport; }
        else if (s === "judge") p.verdicts = payload.verdicts as Verdict[];
        else if (s === "done") { const r = payload as unknown as CompareResponse; setResult(r); persist(r); }
        else if (s === "error") throw new Error(String(payload.error));
        setLive({ ...p });
        if (STAGE_INDEX[s]) setStage(STAGE_INDEX[s]);
      }, abort.current.signal);
      setPhase("done");
    } catch (err) {
      if (liveRef.current.cells) { setResult(partialResult()); setPhase("done"); return; }
      setPhase("empty");
      setError((err as Error).name === "AbortError" ? "Stopped before any cells were extracted." : String((err as Error).message ?? err));
    }
  };
  const reset = () => { setPhase("empty"); setResult(null); setLive({}); liveRef.current = {}; setStage(0); setSelected(null); setError(""); persist(null); };
  const loadExample = (r: CompareRequest) => { setYou(r.your_company); setComps(r.competitors); setIndustry(r.industry); setCustom(r.custom_fields ?? []); };
  const updated = (c: Comparison) => { if (!result) return; const next = { ...result, comparison: c }; setResult(next); persist(next); };

  const sel = selected && cells ? {
    entity: entities.find((e) => e.id === selected.entityId),
    field: fields.find((f) => f.id === selected.fieldId),
    cell: cells.find((c) => c.entity_id === selected.entityId && c.field_id === selected.fieldId),
    source: sources.find((s) => s.entity_id === selected.entityId),
    verdict: verdicts.find((v) => v.entity_id === selected.entityId && v.field_id === selected.fieldId),
  } : null;
  const panelOpen = !!(sel?.entity && sel.field && sel.cell && sel.source);
  const canRun = !!you.text.trim() && comps.length > 0 && comps.every((c) => c.text.trim());

  return (
    <div className="ws">
      <header className="nav ws-nav">
        <div className="nav-brand" style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          Competitor Comparison
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>evidence-first</span>
        </div>
        <div className="muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 7, height: 7, display: "inline-block", background: health ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text) 30%, transparent)" }} />
          {health ? `Engine: headless Claude${health.jev_attached ? " · Jev attached" : ""}` : "Engine: connecting…"}
        </div>
        <ThemeToggle />
      </header>

      <div className="ws-grid">
        <aside className="ws-aside">
          <div>
            <h6 style={{ margin: "0 0 4px" }}>Step 1 · Sources</h6>
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>Paste anything: website copy, call notes, a rough impression. Nothing is invented from thin air — every cell points back here.</p>
            {Object.keys(examples).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {Object.entries(examples).map(([k, r]) => (
                  <button key={k} type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 6px" }} onClick={() => loadExample(r)}>load {k.replace(/_/g, " ")}</button>
                ))}
              </div>
            )}
          </div>

          <SourceCard kicker="Your company" anchor value={you} rows={formFields.length} onChange={setYou} />
          {comps.map((c, i) => (
            <SourceCard key={i} kicker={`Competitor ${i + 1}`} value={c} rows={formFields.length}
              onChange={(v) => setComps(comps.map((x, j) => (j === i ? v : x)))}
              onRemove={comps.length > 1 ? () => setComps(comps.filter((_, j) => j !== i)) : undefined} />
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={comps.length >= 3} onClick={() => setComps([...comps, empty()])}>+ Add competitor</button>
            <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>3 max, so the table stays readable</span>
          </div>

          <div style={{ height: 1, background: "var(--color-divider)" }} />

          <TemplatePicker industry={industry} industries={presets.industries} coreCount={presets.core.length} presetCount={(presets.fields[industry] ?? []).length}
            onIndustry={setIndustry} customFields={custom} onCustomFields={setCustom} />

          <button type="button" className="btn btn-primary blueprint" onClick={phase === "done" ? reset : run} disabled={phase === "running" || (phase === "empty" && !canRun)}
            style={{ justifyContent: "center", padding: 12, fontSize: 16, letterSpacing: "0.02em" }}>
            <Corners />
            {phase === "running" ? "Generating…" : phase === "done" ? "Start over" : "Generate comparison"}
          </button>
          {phase === "empty" && !canRun && <p className="muted" style={{ margin: "-10px 0 0", fontSize: 11 }}>Add notes for your company and every competitor to enable generation.</p>}
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#b3261e" }}>{error}</p>}
        </aside>

        <main className="ws-main">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ margin: 0 }}>{entities[0]?.name ?? "Your company"} vs. {compCount} competitor{compCount === 1 ? "" : "s"}</h3>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{subhead}</p>
            </div>
            <ExportBar id={comparison?.id ?? ""} disabled={!done} />
          </div>

          <StatsBar cells={cells ?? []} verdicts={verdicts} fields={fields} report={report} showValues={showValues} showVerdicts={showVerdicts} total={fields.length * entities.length} />

          {phase === "running" && <StageStrip stage={stage} onStop={() => abort.current?.abort()} />}

          <div style={{ display: "grid", gridTemplateColumns: panelOpen ? "repeat(auto-fit,minmax(300px,1fr))" : "minmax(0,1fr)", gap: 16, alignItems: "start", minWidth: 0 }}>
            <ComparisonTable fields={fields} entities={entities} cells={cells} verdicts={verdicts} showVerdicts={showVerdicts} selected={selected} onSelect={setSelected} />
            {panelOpen && sel && (
              <EvidencePopover key={`${sel.entity!.id}|${sel.field!.id}|${sel.cell!.status}|${sel.cell!.display_value}`}
                entity={sel.entity!} field={sel.field!} cell={sel.cell!} source={sel.source!} verdict={sel.verdict}
                comparisonId={comparison?.id ?? ""} editable={done} onClose={() => setSelected(null)} onUpdated={updated} />
            )}
          </div>

          <div className="muted" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", fontSize: 11 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 10, display: "inline-block", background: "color-mix(in srgb, var(--color-accent) 22%, transparent)", border: "1px solid var(--color-accent)" }} /> you win this row</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 10, display: "inline-block", background: "color-mix(in srgb, var(--color-text) 12%, transparent)" }} /> you lose</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, height: 10, display: "inline-block", border: "1px solid color-mix(in srgb, var(--color-text) 25%, transparent)" }} /> even</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span className="hatch" style={{ width: 16, height: 10, display: "inline-block", border: "1px dashed color-mix(in srgb, var(--color-text) 30%, transparent)" }} /> not enough data — never guessed</span>
            <span style={{ marginLeft: "auto" }}>Click any cell to see the sentence it came from.</span>
          </div>

          {report && report.notes.length > 0 && (
            <details className="muted" style={{ fontSize: 12 }}>
              <summary style={{ cursor: "pointer" }}>Verification notes ({report.notes.length})</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{report.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </details>
          )}
        </main>
      </div>
    </div>
  );
}
