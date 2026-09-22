"use client";
import Corners from "./Corners";
import type { Cell, ComparisonRule, Entity, FieldDefinition, Status, Verdict, VerdictKind } from "@/lib/types";

export type Sel = { entityId: string; fieldId: string };
export const RULE_LABEL: Record<ComparisonRule, string> = {
  lower_is_better: "lower is better", higher_is_better: "higher is better", presence_is_better: "presence is better", qualitative_llm: "qualitative", not_compared: "not compared",
};
export const VERDICT_LABEL: Record<VerdictKind, string> = { win: "↑ you win", lose: "↓ you lose", tie: "= even", "n/a": "· no data" };
const verdictClass = (v: VerdictKind) => (v === "n/a" ? "verdict-na" : `verdict-${v}`);

export const StatusBadge = ({ status }: { status: Status }) => <span className={`badge badge-${status}`}>{status}</span>;
export const VerdictBadge = ({ verdict }: { verdict: VerdictKind }) => <span className={`verdict ${verdictClass(verdict)}`}>{VERDICT_LABEL[verdict]}</span>;

export default function ComparisonTable({
  fields, entities, cells, verdicts, showVerdicts, selected, onSelect, stale = new Set<string>(),
}: { fields: FieldDefinition[]; entities: Entity[]; cells: Cell[] | null; verdicts: Verdict[]; showVerdicts: boolean; selected: Sel | null; onSelect: (s: Sel) => void; stale?: Set<string> }) {
  const you = entities.find((e) => e.is_your_company);
  const cols = [...(you ? [you] : []), ...entities.filter((e) => !e.is_your_company)];
  const cellMap = new Map((cells ?? []).map((c) => [`${c.entity_id}|${c.field_id}`, c]));
  const verdictMap = new Map(verdicts.map((v) => [`${v.entity_id}|${v.field_id}`, v]));

  return (
    <div className="blueprint" style={{ padding: 0, overflowX: "auto" }}>
      <Corners />
      <table className="table" style={{ minWidth: 640 }}>
        <thead>
          <tr>
            <th style={{ width: 170, padding: "10px 12px" }}>Field</th>
            {cols.map((e) => (
              <th key={e.id} className={e.is_your_company ? "col-you" : undefined} style={{ padding: "10px 12px" }}>
                {e.name}{e.is_your_company ? " — you" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id}>
              <th scope="row" className="row-th">
                {f.label}{f.custom && <span className="kicker" style={{ marginLeft: 6 }}>custom</span>}
                <div className="row-rule">{RULE_LABEL[f.comparison_rule]}</div>
              </th>
              {cols.map((e) => {
                const c = cellMap.get(`${e.id}|${f.id}`);
                const v = showVerdicts && !e.is_your_company && f.comparison_rule !== "not_compared" ? verdictMap.get(`${e.id}|${f.id}`) : undefined;
                const isSel = selected?.entityId === e.id && selected?.fieldId === f.id;
                const cls = ["cell", c?.status === "missing" ? "hatch" : "", v?.verdict === "win" ? "cell-win" : v?.verdict === "lose" ? "cell-lose" : "", isSel ? "cell-selected" : ""].join(" ");
                return (
                  <td key={e.id} className={cls} style={c ? undefined : { cursor: "default" }} onClick={c ? () => onSelect({ entityId: e.id, fieldId: f.id }) : undefined}>
                    {c ? <div className={`cell-value ${c.status}`}>{c.status === "missing" ? "not in the notes" : c.display_value}</div> : <div className="skeleton" />}
                    {c && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7, alignItems: "center" }}>
                        <StatusBadge status={c.status} />
                        {v && <VerdictBadge verdict={v.verdict} />}
                        {stale.has(e.id) && c.status !== "missing" && <span className="tag-stale">stale source</span>}
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
