import type { Source, SourceKind } from "./types";

export type Level = "fresh" | "aging" | "stale";
export const KIND_LABEL: Record<SourceKind, string> = { notes: "Notes", public: "Public", internal: "Internal" };
/** Tolerant lookups: sources saved by older builds may lack `kind`. */
export const kindOf = (k: string | undefined): SourceKind => (k && k in KIND_LABEL ? (k as SourceKind) : "notes");
export const kindLabel = (k: string | undefined) => KIND_LABEL[kindOf(k)];

/** Fill fields that older saved comparisons did not have. */
export const normalizeSource = (s: Partial<Source> & { source_id: string; entity_id: string; text: string }): Source =>
  ({ title: "", captured_at: "", outdated: false, ...s, kind: kindOf(s.kind) });

export const daysOld = (iso: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

/** Freshness rules: fresh under 30 days, aging 30 to 90, stale over 90 or marked outdated. */
export function freshness(src: Pick<Source, "captured_at" | "outdated">): { level: Level; days: number; label: string } {
  const days = daysOld(src.captured_at);
  if (src.outdated) return { level: "stale", days, label: `${days} days · marked outdated` };
  const level: Level = days < 30 ? "fresh" : days <= 90 ? "aging" : "stale";
  return { level, days, label: `${days} day${days === 1 ? "" : "s"}` };
}

export const levelClass: Record<Level, string> = { fresh: "ok", aging: "warn", stale: "bad" };

export const fmtDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "today";

export const staleEntities = (sources: Source[]) => new Set(sources.filter((s) => freshness(s).level === "stale").map((s) => s.entity_id));
