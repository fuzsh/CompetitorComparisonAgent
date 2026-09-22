import type { Source, SourceKind } from "./types";

export type Level = "fresh" | "aging" | "stale";
export const KIND_LABEL: Record<SourceKind, string> = { notes: "Notes", public: "Public", internal: "Internal" };

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
