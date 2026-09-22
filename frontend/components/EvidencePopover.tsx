"use client";
import { useEffect, useState } from "react";
import { patchCell } from "@/lib/api";
import type { Comparison, Status } from "@/lib/types";
import { ICON, StatusBadge } from "./ComparisonTable";

export default function EvidencePopover({
  comparison, selected, editable, onClose, onUpdated,
}: {
  comparison: Comparison;
  selected: { entityId: string; fieldId: string };
  editable: boolean;
  onClose: () => void;
  onUpdated: (c: Comparison) => void;
}) {
  const entity = comparison.entities.find((e) => e.id === selected.entityId)!;
  const field = comparison.fields.find((f) => f.id === selected.fieldId)!;
  const cell = comparison.cells.find((c) => c.entity_id === selected.entityId && c.field_id === selected.fieldId);
  const source = comparison.sources.find((s) => s.source_id === entity.source_id)!;
  const verdict = comparison.verdicts.find((v) => v.entity_id === selected.entityId && v.field_id === selected.fieldId);
  const [value, setValue] = useState(cell?.display_value ?? "");
  const [status, setStatus] = useState<Status>(cell?.status ?? "missing");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    setValue(cell?.display_value ?? "");
    setStatus(cell?.status ?? "missing");
    setErr("");
  }, [cell]);

  const spans = [...(cell?.evidence ?? [])].filter((e) => e.verified).sort((a, b) => a.start_char - b.start_char);
  const parts: { text: string; mark: boolean }[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start_char < pos) continue;
    parts.push({ text: source.text.slice(pos, s.start_char), mark: false }, { text: source.text.slice(s.start_char, s.end_char), mark: true });
    pos = s.end_char;
  }
  parts.push({ text: source.text.slice(pos), mark: false });
  const bucket = !cell ? "" : cell.confidence >= 0.75 ? "high" : cell.confidence >= 0.5 ? "medium" : "low";

  const save = async () => {
    setSaving(true);
    setErr("");
    try {
      onUpdated(await patchCell(comparison.id, { field_id: field.id, entity_id: entity.id, value: status === "missing" ? null : value, status }));
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };
  const input = "rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700";

  return (
    <aside className="sticky top-4 max-h-[90vh] overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-semibold">
          {entity.name} · {field.label}
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">✕</button>
      </div>
      {cell && (
        <>
          <p>
            <span className="text-neutral-500">Value:</span> {cell.status === "missing" ? "—" : cell.display_value} <StatusBadge status={cell.status} />
          </p>
          <p className="text-xs text-neutral-500">
            Confidence: {bucket} ({Math.round(cell.confidence * 100)}%){cell.note ? ` · ${cell.note}` : ""}
          </p>
        </>
      )}
      {verdict && (
        <p className="mt-2">
          <span aria-hidden>{ICON[verdict.verdict]}</span> <b>{verdict.verdict}</b> — {verdict.rationale} <span className="text-neutral-500">({verdict.method})</span>
        </p>
      )}
      <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">Source notes</h3>
      {spans.length === 0 && <p className="my-1 italic text-neutral-500">No supporting text found in notes.</p>}
      <pre className="mt-1 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-2 font-sans text-sm dark:border-neutral-800 dark:bg-neutral-950">
        {parts.map((p, i) => (p.mark ? <mark key={i} className="rounded bg-amber-200 px-0.5 text-neutral-900">{p.text}</mark> : <span key={i}>{p.text}</span>))}
      </pre>
      {editable && cell && (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input className={`${input} flex-1 min-w-32`} value={value} onChange={(e) => setValue(e.target.value)} placeholder={field.type === "price" ? "e.g. $10/month" : "value"} disabled={status === "missing"} />
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            <option value="stated">stated</option>
            <option value="inferred">inferred</option>
            <option value="missing">missing</option>
          </select>
          <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50">
            {saving ? "Re-judging…" : "Save & re-judge row"}
          </button>
          {err && <span className="text-xs text-red-600">{err}</span>}
        </form>
      )}
    </aside>
  );
}
