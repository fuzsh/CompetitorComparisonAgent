"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import EvidencePopover from "@/components/EvidencePopover";
import ExportBar from "@/components/ExportBar";
import type { CompareResponse, Comparison } from "@/lib/types";

export default function ResultPage() {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [none, setNone] = useState(false);
  const [selected, setSelected] = useState<{ entityId: string; fieldId: string } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("comparison");
    if (raw) setData(JSON.parse(raw) as CompareResponse);
    else setNone(true);
  }, []);

  if (none)
    return (
      <main className="mx-auto max-w-4xl p-6 text-sm">
        No comparison yet. <Link className="text-blue-600 underline" href="/">Start one</Link>.
      </main>
    );
  if (!data) return <main className="mx-auto max-w-4xl p-6 text-sm text-neutral-500">Loading…</main>;

  const { comparison, verification_report: rep, partial } = data;
  const update = (c: Comparison) => {
    const next = { ...data, comparison: c };
    setData(next);
    sessionStorage.setItem("comparison", JSON.stringify(next));
  };

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Comparison</h1>
        <Link className="text-sm text-blue-600 underline" href="/">← New comparison</Link>
      </div>
      {partial && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Partial result: generation stopped or failed after extraction. Cells are shown; verdicts, editing and export need a completed run.
        </p>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <ExportBar id={comparison.id} disabled={partial} />
        <p className="text-xs text-neutral-500">
          Verification: {rep.checked_cells} cells checked · {rep.downgraded_cells} downgraded · {rep.unverified_quotes} quotes rejected
        </p>
      </div>
      <p className="mb-2 text-xs text-neutral-500">
        <span className="mr-3">✅ win</span><span className="mr-3">❌ lose</span><span className="mr-3">➖ tie</span><span className="mr-3">⚪ insufficient data</span>
        <span className="mr-3"><b>STATED</b> quoted from notes</span><span className="mr-3"><i>inferred</i> reasoned, lower confidence</span><span>missing = not in notes</span>
        <span className="ml-3">Click any cell to see its evidence.</span>
      </p>
      <div className={`grid gap-4 ${selected ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <ComparisonTable comparison={comparison} selected={selected} onSelect={(entityId, fieldId) => setSelected({ entityId, fieldId })} />
        {selected && <EvidencePopover comparison={comparison} selected={selected} editable={!partial} onClose={() => setSelected(null)} onUpdated={update} />}
      </div>
      {rep.notes.length > 0 && (
        <details className="mt-4 text-xs text-neutral-600 dark:text-neutral-400">
          <summary className="cursor-pointer">Verification notes ({rep.notes.length})</summary>
          <ul className="mt-1 list-disc pl-5">{rep.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </details>
      )}
    </main>
  );
}
