"use client";
import type { EntityInput } from "@/lib/types";

export default function NoteBox({
  index, value, onChange, onRemove, canRemove,
}: { index: number; value: EntityInput; onChange: (v: EntityInput) => void; onRemove: () => void; canRemove: boolean }) {
  return (
    <fieldset className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
      <legend className="px-1 text-sm font-medium text-neutral-500">Competitor {index + 1}</legend>
      <div className="mb-2 flex gap-2">
        <input
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          placeholder={`Name (optional, defaults to "Competitor ${index + 1}")`}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        {canRemove && (
          <button type="button" onClick={onRemove} className="rounded-md border border-neutral-300 px-3 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Remove
          </button>
        )}
      </div>
      <textarea
        className="min-h-24 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        placeholder="Paste website copy, call notes, or a rough impression…"
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        required
      />
    </fieldset>
  );
}
