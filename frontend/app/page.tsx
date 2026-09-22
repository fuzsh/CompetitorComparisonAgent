"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import BattlecardTab from "@/components/BattlecardTab";
import type { Sel } from "@/components/ComparisonTable";
import EvidencePopover from "@/components/EvidencePopover";
import ExportBar from "@/components/ExportBar";
import FullDetailsTab from "@/components/FullDetailsTab";
import OverviewTab from "@/components/OverviewTab";
import SourcesTab from "@/components/SourcesTab";
import StageStrip from "@/components/StageStrip";
import Tabs, { type TabId } from "@/components/Tabs";
import { prettyIndustry } from "@/components/TemplatePicker";
import ThemeToggle from "@/components/ThemeToggle";
import { API, exportComparison, getExamples, getHealth, getPresets, streamComparison } from "@/lib/api";
import { KIND_LABEL, fmtDate } from "@/lib/freshness";
import type { Cell, CompareRequest, CompareResponse, Comparison, Entity, EntityInput, FieldDefinition, Source, Verdict, VerificationReport } from "@/lib/types";

const empty = (): EntityInput => ({ name: "", text: "", kind: "notes", captured_at: null });
const STAGE_INDEX: Record<string, number> = { segment: 1, schema: 2, extract: 3, verify: 4, judge: 5, done: 6 };
const SAVED = "comparison";
type Phase = "empty" | "running" | "done";
type Live = { entities?: Entity[]; sources?: Source[]; fields?: FieldDefinition[]; cells?: Cell[]; verdicts?: Verdict[]; report?: VerificationReport };
const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

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
  const [tab, setTab] = useState<TabId>("sources");
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
      if (raw) { setResult(JSON.parse(raw) as CompareResponse); setPhase("done"); setTab("overview"); }
    } catch {}
  }, []);

  // What the tabs show: finished result > live stream > the form itself.
  const formFields = useMemo(() => {
    const seen = new Set<string>();
    return [...presets.core, ...(presets.fields[industry] ?? []), ...custom].filter((f) => !seen.has(f.id) && !!seen.add(f.id));
  }, [presets, industry, custom]);
  const formEntities = useMemo<Entity[]>(() => [
    { id: "you", name: you.name.trim() || "Your company", is_your_company: true, source_id: "src_you" },
    ...comps.map((c, i) => ({ id: `c${i + 1}`, name: c.name.trim() || `Competitor ${i + 1}`, is_your_company: false, source_id: `src_c${i + 1}` })),
  ], [you.name, comps]);
  const formSources = useMemo<Source[]>(() => [
    { source_id: "src_you", entity_id: "you", text: you.text, title: `${you.name.trim() || "Your company"} notes`, kind: you.kind, captured_at: you.captured_at ?? "", outdated: false },
    ...comps.map((c, i) => ({ source_id: `src_c${i + 1}`, entity_id: `c${i + 1}`, text: c.text, title: `${c.name.trim() || `Competitor ${i + 1}`} notes`, kind: c.kind, captured_at: c.captured_at ?? "", outdated: false })),
  ], [you, comps]);

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
  const names = Object.fromEntries(entities.map((e) => [e.id, e.name]));
  const compNames = entities.filter((e) => !e.is_your_company).map((e) => e.name);

  const kinds = new Set(sources.map((s) => s.kind));
  const kindSummary = kinds.has("public") && kinds.has("internal") ? "public and internal" : [...kinds].map((k) => KIND_LABEL[k].toLowerCase()).join(" and ") || "notes";
  const updated = comparison?.meta.created_at ? `Updated ${fmtDate(String(comparison.meta.created_at))}` : "Not generated yet";
  const subhead = tab === "sources"
    ? "Step 1 · Sources and inputs. Everything in the tables traces back to one of these."
    : tab === "details"
      ? partial ? "Partial result — stopped before verdicts. Every value shown is quoted or labelled; nothing was guessed."
        : phase === "running" ? "Filling in… values appear only once a quote backs them."
          : "Every value below is either quoted from your notes, labelled as an inference, or left blank on purpose."
      : `${updated} · ${sources.length} source${sources.length === 1 ? "" : "s"}, ${kindSummary} · Click any cell to see where it comes from`;

  const persist = (r: CompareResponse | null) => {
    try { if (r) sessionStorage.setItem(SAVED, JSON.stringify(r)); else sessionStorage.removeItem(SAVED); } catch {}
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
    setError(""); setResult(null); setSelected(null); setLive({}); liveRef.current = {}; setStage(0); setPhase("running"); persist(null); setTab("details");
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
      setPhase("done"); setTab("overview");
    } catch (err) {
      if (liveRef.current.cells) { setResult(partialResult()); setPhase("done"); return; }
      setPhase("empty"); setTab("sources");
      setError((err as Error).name === "AbortError" ? "Stopped before any cells were extracted." : String((err as Error).message ?? err));
    }
  };
  const loadExample = (r: CompareRequest) => {
    const norm = (e: EntityInput) => ({ ...empty(), ...e });
    setYou(norm(r.your_company)); setComps(r.competitors.map(norm)); setIndustry(r.industry); setCustom(r.custom_fields ?? []);
  };
  const updateComparison = (c: Comparison) => { if (!result) return; const next = { ...result, comparison: c }; setResult(next); persist(next); };
  const exportSlide = async () => {
    if (!comparison) return;
    const url = URL.createObjectURL(await exportComparison(comparison.id, "pptx"));
    Object.assign(document.createElement("a"), { href: url, download: "comparison.pptx" }).click();
    URL.revokeObjectURL(url);
  };

  const sel = selected && cells ? {
    entity: entities.find((e) => e.id === selected.entityId),
    field: fields.find((f) => f.id === selected.fieldId),
    cell: cells.find((c) => c.entity_id === selected.entityId && c.field_id === selected.fieldId),
    source: sources.find((s) => s.entity_id === selected.entityId),
    verdict: verdicts.find((v) => v.entity_id === selected.entityId && v.field_id === selected.fieldId),
  } : null;
  const panelOpen = !!(sel?.entity && sel.field && sel.cell && sel.source);
  const canRun = !!you.text.trim() && comps.length > 0 && comps.every((c) => c.text.trim());
  const disabledTabs: TabId[] = [...(showValues ? [] : ["overview" as TabId]), ...(showVerdicts ? [] : ["battlecards" as TabId])];
  const editInputs = <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setTab("sources")}>Edit inputs</button>;

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

      <div className="title-block">
        <div>
          <div className="kicker">Competitor comparison</div>
          <h2 style={{ margin: 0 }}>{entities[0]?.name ?? "Your company"} vs {compNames.length ? joinNames(compNames) : "…"}</h2>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{subhead}</p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {tab === "sources" && (
            <>
              <span className="btn btn-secondary" style={{ fontSize: 12, cursor: "default" }}>Field template: {prettyIndustry(industry)}</span>
              {Object.keys(examples).length > 0 && Object.entries(examples).map(([k, r]) => (
                <button key={k} type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => loadExample(r)}>load {k.replace(/_/g, " ")}</button>
              ))}
              <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={phase === "running" || !canRun} onClick={run}>
                {phase === "running" ? "Generating…" : result ? "Regenerate comparison" : "Generate comparison"}
              </button>
            </>
          )}
          {tab === "overview" && <>{editInputs}<button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={!done} onClick={exportSlide}>Export to slide</button></>}
          {tab === "battlecards" && editInputs}
          {tab === "details" && <>{editInputs}<ExportBar id={comparison?.id ?? ""} disabled={!done} /></>}
        </div>
      </div>

      <Tabs tab={tab} onTab={setTab} disabled={disabledTabs} />

      <main className="ws-main">
        {phase === "running" && <StageStrip stage={stage} onStop={() => abort.current?.abort()} />}
        {error && <p role="alert" className="bad" style={{ margin: 0, fontSize: 12 }}>{error}</p>}

        {tab === "sources" && (
          <SourcesTab you={you} comps={comps} onYou={setYou} onComps={setComps} sources={sources} names={names} rows={formFields.length}
            industry={industry} industries={presets.industries} coreCount={presets.core.length} presetCount={(presets.fields[industry] ?? []).length} onIndustry={setIndustry}
            custom={custom} onCustom={setCustom} onRun={run} canRun={canRun} running={phase === "running"}
            runLabel={phase === "running" ? "Generating…" : result ? "Regenerate comparison" : "Generate comparison"} />
        )}
        {tab === "overview" && cells && (
          <OverviewTab fields={fields} entities={entities} cells={cells} verdicts={verdicts} sources={sources} selected={selected} onSelect={setSelected} />
        )}
        {tab === "battlecards" && comparison && (
          <BattlecardTab key={comparison.id} comparison={comparison} done={done} onOpenSources={() => setTab("sources")} onUpdated={updateComparison} onSelect={setSelected} />
        )}
        {tab === "details" && (
          <FullDetailsTab fields={fields} entities={entities} cells={cells} verdicts={verdicts} sources={sources} report={report}
            showValues={showValues} showVerdicts={showVerdicts} selected={selected} onSelect={setSelected} />
        )}
      </main>

      {panelOpen && sel && (
        <EvidencePopover key={`${sel.entity!.id}|${sel.field!.id}|${sel.cell!.status}|${sel.cell!.display_value}|${sel.source!.captured_at}|${sel.source!.outdated}`}
          entity={sel.entity!} field={sel.field!} cell={sel.cell!} source={sel.source!} verdict={sel.verdict}
          comparisonId={comparison?.id ?? ""} editable={done} onClose={() => setSelected(null)} onUpdated={updateComparison} />
      )}
    </div>
  );
}
