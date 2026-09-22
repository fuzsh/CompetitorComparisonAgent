"use client";
import type { EntityInput } from "@/lib/types";

export default function YourCompanyBox({ value, onChange }: { value: EntityInput; onChange: (v: EntityInput) => void }) {
  return (
    <fieldset className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <legend className="px-1 text-sm font-medium text-neutral-500">Your company (anchor column)</legend>
      <input
        className="mb-2 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        placeholder="Company name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      <textarea
        className="min-h-24 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        placeholder="What you offer, pricing, features, who it's for…"
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        required
      />
    </fieldset>
  );
}
