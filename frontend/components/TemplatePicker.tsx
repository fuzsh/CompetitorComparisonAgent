"use client";
import { useState } from "react";
import type { ComparisonRule, FieldDefinition, FieldType } from "@/lib/types";

const TYPES: FieldType[] = ["boolean", "price", "number", "list", "categorical", "free_text"];
const RULES: ComparisonRule[] = ["presence_is_better", "lower_is_better", "higher_is_better", "qualitative_llm", "not_compared"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "f_$1") || "custom";

export default function TemplatePicker({
  industry, industries, onIndustry, customFields, onCustomFields,
}: {
  industry: string;
  industries: Record<string, string[]>;
  onIndustry: (v: string) => void;
  customFields: FieldDefinition[];
  onCustomFields: (v: FieldDefinition[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("boolean");
  const [rule, setRule] = useState<ComparisonRule>("presence_is_better");
  const input = "rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";

  const add = () => {
    if (!label.trim()) return;
    const id = slug(label);
    if (customFields.some((f) => f.id === id)) return;
    onCustomFields([...customFields, { id, label: label.trim(), type, comparison_rule: rule, custom: true, description: "" }]);
    setLabel("");
  };

  return (
    <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <legend className="px-1 text-sm font-medium text-neutral-500">Rows: industry template + custom rows</legend>
      <label className="block text-sm">
        Industry preset
        <select className={`${input} ml-2`} value={industry} onChange={(e) => onIndustry(e.target.value)}>
          {Object.entries(industries).map(([k, labels]) => (
            <option key={k} value={k}>
              {k}{labels.length ? ` (+ ${labels.join(", ")})` : " (core rows only)"}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1 text-xs text-neutral-500">Core rows always included: Starting price, Key features, Target audience, Positioning angle, Notable weakness.</p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input className={`${input} flex-1 min-w-40`} placeholder="Custom row label, e.g. SSO support" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select className={input} value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={input} value={rule} onChange={(e) => setRule(e.target.value as ComparisonRule)}>
          {RULES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="button" onClick={add} className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
          Add row
        </button>
      </div>
      {customFields.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs">
          {customFields.map((f) => (
            <li key={f.id} className="flex items-center gap-1 rounded-full border border-neutral-300 px-2 py-1 dark:border-neutral-700">
              <span>{f.label}</span>
              <span className="text-neutral-500">{f.type} · {f.comparison_rule}</span>
              <button type="button" aria-label={`Remove ${f.label}`} onClick={() => onCustomFields(customFields.filter((x) => x.id !== f.id))} className="ml-1 text-neutral-500 hover:text-red-600">×</button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
