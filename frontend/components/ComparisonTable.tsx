"use client";
import type { Cell, Comparison, Status } from "@/lib/types";

export const VERDICT_STYLE: Record<string, string> = {
  win: "bg-emerald-100 dark:bg-emerald-900/40",
  lose: "bg-rose-100 dark:bg-rose-900/40",
  tie: "bg-neutral-100 dark:bg-neutral-800/60",
  "n/a": "bg-neutral-50 dark:bg-neutral-900",
};
export const ICON: Record<string, string> = { win: "✅", lose: "❌", tie: "➖", "n/a": "⚪" };
const border = "border border-neutral-200 dark:border-neutral-800";

export function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === "stated"
      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
      : status === "inferred"
        ? "border border-neutral-500 italic text-neutral-700 dark:text-neutral-300"
        : "border border-neutral-300 text-neutral-500 dark:border-neutral-700";
  return <span className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>{status}</span>;
}

function CellView({ cell }: { cell?: Cell }) {
  if (!cell) return <span className="text-neutral-400">…</span>;
  if (cell.status === "missing")
    return (
      <span className="italic text-neutral-500">
        insufficient info <StatusBadge status="missing" />
      </span>
    );
  return (
    <span className={cell.status === "inferred" ? "italic" : ""} title={`confidence ${Math.round(cell.confidence * 100)}%${cell.note ? " · " + cell.note : ""}`}>
      {cell.display_value}
      <StatusBadge status={cell.status} />
    </span>
  );
}

export default function ComparisonTable({
  comparison, selected, onSelect,
}: { comparison: Comparison; selected?: { entityId: string; fieldId: string } | null; onSelect: (entityId: string, fieldId: string) => void }) {
  const you = comparison.entities.find((e) => e.is_your_company)!;
  const comps = comparison.entities.filter((e) => !e.is_your_company);
  const cells = new Map(comparison.cells.map((c) => [`${c.entity_id}|${c.field_id}`, c]));
  const verdicts = new Map(comparison.verdicts.map((v) => [`${v.entity_id}|${v.field_id}`, v]));
  const ring = (e: string, f: string) => (selected?.entityId === e && selected?.fieldId === f ? "outline outline-2 outline-blue-500" : "");
  const td = `${border} cursor-pointer p-2 align-top hover:outline hover:outline-1 hover:outline-blue-400`;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100 dark:bg-neutral-900">
            <th className={`${border} p-2 text-left`}>Field</th>
            <th className={`${border} p-2 text-left`}>
              {you.name} <span className="text-xs font-normal text-neutral-500">(you)</span>
            </th>
            {comps.map((c) => (
              <th key={c.id} className={`${border} p-2 text-left`}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.fields.map((f) => (
            <tr key={f.id}>
              <th scope="row" className={`${border} p-2 text-left font-medium`}>
                {f.label}
                {f.custom && <span className="ml-1 text-[10px] font-normal text-neutral-500">custom</span>}
              </th>
              <td className={`${td} ${ring(you.id, f.id)}`} onClick={() => onSelect(you.id, f.id)}>
                <CellView cell={cells.get(`${you.id}|${f.id}`)} />
              </td>
              {comps.map((c) => {
                const v = verdicts.get(`${c.id}|${f.id}`);
                return (
                  <td key={c.id} className={`${td} ${v ? VERDICT_STYLE[v.verdict] : ""} ${ring(c.id, f.id)}`} onClick={() => onSelect(c.id, f.id)}>
                    <CellView cell={cells.get(`${c.id}|${f.id}`)} />
                    {v && (
                      <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-400" title={v.rationale}>
                        <span aria-hidden>{ICON[v.verdict]}</span> <b>{v.verdict === "n/a" ? "insufficient data" : v.verdict}</b> · {v.rationale}
                        <span className="ml-1 text-neutral-400">({v.method})</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
