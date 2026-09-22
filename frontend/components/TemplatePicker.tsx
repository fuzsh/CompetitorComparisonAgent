"use client";
import { useState } from "react";
import type { ComparisonRule, FieldDefinition, FieldType } from "@/lib/types";

const TYPES: FieldType[] = ["boolean", "price", "number", "list", "categorical", "free_text"];
const RULES: ComparisonRule[] = ["presence_is_better", "lower_is_better", "higher_is_better", "qualitative_llm", "not_compared"];
const PRETTY: Record<string, string> = { saas: "SaaS", generic: "Generic" };
export const prettyIndustry = (k: string) => PRETTY[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1") || "custom";

export default function TemplatePicker({
  industry, industries, coreCount, presetCount, onIndustry, customFields, onCustomFields,
}: {
  industry: string;
  industries: string[];
  coreCount: number;
  presetCount: number;
  onIndustry: (v: string) => void;
  customFields: FieldDefinition[];
  onCustomFields: (v: FieldDefinition[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("boolean");
  const [rule, setRule] = useState<ComparisonRule>("presence_is_better");

  const add = () => {
    const id = slug(label);
    if (!label.trim() || customFields.some((f) => f.id === id)) return;
    onCustomFields([...customFields, { id, label: label.trim(), type, comparison_rule: rule, custom: true, description: "" }]);
    setLabel("");
  };

  return (
    <div>
      <h6 style={{ margin: "0 0 8px" }}>Step 2 · Rows</h6>
      <div className="seg" role="radiogroup" aria-label="Industry preset" style={{ width: "100%", flexWrap: "wrap" }}>
        {industries.map((k) => (
          <label key={k} className="seg-opt" style={{ flex: 1, justifyContent: "center" }}>
            <input type="radio" name="preset" value={k} checked={industry === k} onChange={() => onIndustry(k)} />
            <span>{prettyIndustry(k)}</span>
          </label>
        ))}
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 11 }}>
        {coreCount} core rows{presetCount ? ` + ${presetCount} ${prettyIndustry(industry)} rows` : ""}. Add your own below — label, type, and how it should be judged.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <input className="input" placeholder="e.g. SSO support" value={label} onChange={(e) => setLabel(e.target.value)} style={{ flex: "1 1 120px", fontSize: 13 }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <select className="input" aria-label="Row type" value={type} onChange={(e) => setType(e.target.value as FieldType)} style={{ width: "auto", fontSize: 12 }}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" aria-label="How to judge" value={rule} onChange={(e) => setRule(e.target.value as ComparisonRule)} style={{ width: "auto", fontSize: 12 }}>
          {RULES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={add}>Add row</button>
      </div>
      {customFields.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {customFields.map((f) => (
            <span key={f.id} className="tag tag-outline" style={{ gap: 6 }}>
              {f.label} <span className="muted">{f.type} · {f.comparison_rule.replace(/_/g, " ")}</span>
              <button type="button" aria-label={`Remove ${f.label}`} className="btn btn-ghost" style={{ padding: 0, fontSize: 12, lineHeight: 1 }}
                onClick={() => onCustomFields(customFields.filter((x) => x.id !== f.id))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
