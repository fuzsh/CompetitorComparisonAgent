"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NoteBox from "@/components/NoteBox";
import TemplatePicker from "@/components/TemplatePicker";
import YourCompanyBox from "@/components/YourCompanyBox";
import { API, getExamples, getHealth, getPresets, streamComparison } from "@/lib/api";
import { STAGES } from "@/lib/types";
import type { Cell, CompareRequest, CompareResponse, Entity, EntityInput, FieldDefinition, Source, Stage, Verdict, VerificationReport } from "@/lib/types";

const empty = (): EntityInput => ({ name: "", text: "" });
type Partial_ = { entities?: Entity[]; sources?: Source[]; fields?: FieldDefinition[]; cells?: Cell[]; verdicts?: Verdict[]; report?: VerificationReport };

export default function Home() {
  const router = useRouter();
  const [you, setYou] = useState<EntityInput>(empty());
  const [comps, setComps] = useState<EntityInput[]>([empty(), empty()]);
  const [industry, setIndustry] = useState("saas");
  const [industries, setIndustries] = useState<Record<string, string[]>>({ generic: [], saas: [] });
  const [custom, setCustom] = useState<FieldDefinition[]>([]);
  const [examples, setExamples] = useState<Record<string, CompareRequest>>({});
  const [health, setHealth] = useState<Record<string, string | boolean> | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<Stage[]>([]);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const partial = useRef<Partial_>({});

  useEffect(() => {
    getPresets().then((p) => setIndustries(p.industries)).catch(() => setError(`Backend not reachable at ${API}. Start it with: python main.py`));
    getExamples().then(setExamples).catch(() => {});
    getHealth().then(setHealth).catch(() => {});
  }, []);

  const loadExample = (r: CompareRequest) => {
    setYou(r.your_company);
    setComps(r.competitors);
    setIndustry(r.industry);
    setCustom(r.custom_fields ?? []);
  };

  const savePartial = () => {
    const p = partial.current;
    const payload: CompareResponse = {
      comparison: { id: "partial", meta: {}, entities: p.entities ?? [], sources: p.sources ?? [], fields: p.fields ?? [], cells: p.cells ?? [], verdicts: p.verdicts ?? [] },
      verification_report: p.report ?? { checked_cells: 0, downgraded_cells: 0, unverified_quotes: 0, notes: [] },
      partial: true,
    };
    sessionStorage.setItem("comparison", JSON.stringify(payload));
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone([]);
    setRunning(true);
    partial.current = {};
    abort.current = new AbortController();
    const req: CompareRequest = { your_company: you, competitors: comps, industry, custom_fields: custom };
    try {
      await streamComparison(
        req,
        (stage, payload) => {
          setDone((d) => [...d, stage]);
          const p = partial.current;
          if (stage === "segment") { p.entities = payload.entities as Entity[]; p.sources = payload.sources as Source[]; }
          else if (stage === "schema") p.fields = payload.fields as FieldDefinition[];
          else if (stage === "extract" || stage === "verify") { p.cells = payload.cells as Cell[]; if (stage === "verify") p.report = payload as unknown as VerificationReport; }
          else if (stage === "judge") p.verdicts = payload.verdicts as Verdict[];
          else if (stage === "done") { sessionStorage.setItem("comparison", JSON.stringify(payload)); router.push("/result"); }
          else if (stage === "error") throw new Error(String(payload.error));
        },
        abort.current.signal,
      );
    } catch (err) {
      if (partial.current.cells) { savePartial(); router.push("/result"); return; }
      setError((err as Error).name === "AbortError" ? "Stopped before any cells were extracted." : String((err as Error).message ?? err));
    } finally {
      setRunning(false);
    }
  };

  const btn = "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Competitor Comparison Table</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Paste rough notes. Every cell is traced to a verbatim quote, inferences are labeled, gaps are flagged instead of guessed, and each row is marked win / lose / tie against your company.
        {health && <span className="ml-1">Engine: headless Claude{health.jev_attached ? " + Jev attached" : ""}.</span>}
      </p>

      {Object.keys(examples).length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-500">Load example:</span>
          {Object.entries(examples).map(([k, r]) => (
            <button key={k} type="button" className={btn} onClick={() => loadExample(r)}>{k.replace(/_/g, " ")}</button>
          ))}
        </div>
      )}

      <form onSubmit={generate} className="space-y-4">
        <YourCompanyBox value={you} onChange={setYou} />
        {comps.map((c, i) => (
          <NoteBox key={i} index={i} value={c} onChange={(v) => setComps(comps.map((x, j) => (j === i ? v : x)))} onRemove={() => setComps(comps.filter((_, j) => j !== i))} canRemove={comps.length > 1} />
        ))}
        <div className="flex items-center gap-2 text-sm">
          <button type="button" className={btn} disabled={comps.length >= 3} onClick={() => setComps([...comps, empty()])}>+ Add competitor</button>
          {comps.length >= 3 && <span className="text-neutral-500">Capped at 3 competitors so the table stays readable.</span>}
        </div>
        <TemplatePicker industry={industry} industries={industries} onIndustry={setIndustry} customFields={custom} onCustomFields={setCustom} />

        <div className="flex items-center gap-3">
          <button type="submit" disabled={running} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {running ? "Generating…" : "Generate comparison"}
          </button>
          {running && <button type="button" className={btn} onClick={() => abort.current?.abort()}>Stop (keep partial)</button>}
        </div>
      </form>

      {(running || done.length > 0) && (
        <ol className="mt-4 space-y-1 text-sm">
          {STAGES.map(([stage, label]) => {
            const isDone = done.includes(stage);
            const active = running && !isDone && done.length === STAGES.findIndex(([s]) => s === stage);
            return (
              <li key={stage} className={isDone ? "text-emerald-600" : active ? "" : "text-neutral-400"}>
                {isDone ? "✓" : active ? "…" : "○"} {label}
              </li>
            );
          })}
        </ol>
      )}
      {error && <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    </main>
  );
}
