"use client";
import { useState } from "react";
import Corners from "./Corners";
import type { Sel } from "./ComparisonTable";
import { generateBattlecard } from "@/lib/api";
import { KIND_LABEL, fmtDate, freshness, levelClass } from "@/lib/freshness";
import type { Battlecard, Cell, Comparison, FieldDefinition, Verdict } from "@/lib/types";

type Row = { f: FieldDefinition; y: Cell; t: Cell; v?: Verdict };
const trim = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const rank = (f: FieldDefinition) => (f.type === "price" ? 0 : f.type === "number" ? 1 : f.type === "boolean" ? 2 : 3);

export default function BattlecardTab({
  comparison, done, onOpenSources, onUpdated, onSelect,
}: { comparison: Comparison; done: boolean; onOpenSources: () => void; onUpdated: (c: Comparison) => void; onSelect: (s: Sel) => void }) {
  const you = comparison.entities.find((e) => e.is_your_company)!;
  const comps = comparison.entities.filter((e) => !e.is_your_company);
  const [compId, setCompId] = useState(comps[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const comp = comps.find((c) => c.id === compId) ?? comps[0];
  if (!comp) return <p className="muted">No competitor in this comparison.</p>;

  const cell = (eid: string, fid: string) => comparison.cells.find((c) => c.entity_id === eid && c.field_id === fid)!;
  const rows: Row[] = comparison.fields.map((f) => ({ f, y: cell(you.id, f.id), t: cell(comp.id, f.id), v: comparison.verdicts.find((v) => v.entity_id === comp.id && v.field_id === f.id) }));
  const compared = rows.filter((r) => r.f.comparison_rule !== "not_compared");
  const wins = compared.filter((r) => r.v?.verdict === "win");
  const loses = compared.filter((r) => r.v?.verdict === "lose");
  const ties = compared.filter((r) => r.v?.verdict === "tie");
  const gaps = compared.filter((r) => r.y.status === "missing" || r.t.status === "missing");
  const tiles = rows.filter((r) => r.t.status !== "missing").sort((a, b) => rank(a.f) - rank(b.f) || (a.v?.verdict === "n/a" ? 1 : 0) - (b.v?.verdict === "n/a" ? 1 : 0)).slice(0, 4);
  const source = comparison.sources.find((s) => s.entity_id === comp.id);
  const fresh = source ? freshness(source) : null;
  const card = (comparison.meta.battlecards as Record<string, Battlecard> | undefined)?.[comp.id];
  const toPrepare = compared.filter((r) => r.t.status !== "missing" && (r.v?.verdict === "lose" || r.v?.verdict === "tie" || r.y.status === "missing"));
  const val = (c: Cell, who: string) => (c.status === "missing" ? `${who}: not in the notes` : c.display_value);

  const draft = async () => {
    setBusy(true); setErr("");
    try {
      const bc = await generateBattlecard(comparison.id, comp.id);
      const battlecards = { ...((comparison.meta.battlecards as Record<string, Battlecard>) ?? {}), [comp.id]: bc };
      onUpdated({ ...comparison, meta: { ...comparison.meta, battlecards } });
    } catch (e) { setErr(String((e as Error).message ?? e)); } finally { setBusy(false); }
  };

  const markdown = () => {
    const li = (r: Row) => `- **${r.f.label}.** ${you.name}: ${val(r.y, you.name)} vs ${comp.name}: ${val(r.t, comp.name)}. ${r.v?.rationale ?? ""}`.trim();
    const lines = [`# ${you.name} vs ${comp.name} — battlecard`, "", `## Where ${you.name} wins`, ...(wins.length ? wins.map(li) : ["- (none in the notes)"]),
      "", `## Where ${comp.name} genuinely wins`, ...(loses.length ? loses.map(li) : ["- (none in the notes)"]), "", "## Even", ...(ties.length ? ties.map(li) : ["- (none)"]),
      "", "## Gaps to close", ...gaps.map((r) => `- ${r.f.label}: ${[r.y.status === "missing" ? `${you.name} not in the notes` : "", r.t.status === "missing" ? `${comp.name} not in the notes` : ""].filter(Boolean).join("; ")}`),
      ...(card?.objections.length ? ["", "## Objection handling", ...card.objections.map((o) => `- "${o.objection}" — ${o.response}`)] : []),
      "", source ? `Source: ${source.title} · ${KIND_LABEL[source.kind]} · captured ${fmtDate(source.captured_at)}` : ""];
    return lines.join("\n");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(markdown()); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {} };

  const Bullets = ({ items, color }: { items: Row[]; color: string }) => (
    <ul className="bullets">
      {items.map((r) => (
        <li key={r.f.id} style={{ cursor: "pointer" }} onClick={() => onSelect({ entityId: comp.id, fieldId: r.f.id })}>
          <span className="dot" style={{ color }} />
          <span>
            <b>{r.f.label}.</b> {you.name}: {val(r.y, you.name)} vs {comp.name}: {val(r.t, comp.name)}.{" "}
            {r.v?.rationale && <span className="muted">{r.v.rationale}</span>}{" "}
            {source && <span className={`tag-kind tag-kind-${source.kind}`}>{KIND_LABEL[source.kind]}</span>}{" "}
            {(r.y.status === "inferred" || r.t.status === "inferred") && <span className="badge badge-inferred">inferred</span>}
          </span>
        </li>
      ))}
    </ul>
  );
  const Card = ({ title, sub, titleColor, children }: { title: string; sub: string; titleColor?: string; children: React.ReactNode }) => (
    <div className="blueprint" style={{ padding: 14 }}>
      <Corners />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <h5 style={{ margin: 0, color: titleColor }}>{title}</h5><span className="muted" style={{ fontSize: 12 }}>{sub}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }} className="muted">
          {you.name} vs
          <div className="seg" role="radiogroup" aria-label="Competitor">
            {comps.map((c) => (
              <label key={c.id} className="seg-opt"><input type="radio" name="battlecard-comp" checked={comp.id === c.id} onChange={() => setCompId(c.id)} /><span>{c.name}</span></label>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={copy}>{copied ? "Copied" : "Copy battlecard (Markdown)"}</button>
      </div>

      {tiles.length > 0 && (
        <div className="tiles">
          {tiles.map((r) => (
            <div key={r.f.id} className="blueprint tile" style={{ cursor: "pointer" }} onClick={() => onSelect({ entityId: comp.id, fieldId: r.f.id })}>
              <Corners />
              <div className="tile-big">{r.f.type === "boolean" ? `${r.t.display_value === "Yes" ? "✓" : "✗"} ${r.f.label}` : trim(r.t.display_value)}</div>
              <div className="tile-sub muted">{comp.name} {r.f.label.toLowerCase()}. {you.name}: {r.y.status === "missing" ? "not in our notes" : r.y.display_value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="two-col" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Card title={`Where ${you.name} wins`} sub="Lead with these" titleColor="var(--color-accent-800)">
          {wins.length ? <Bullets items={wins} color="var(--color-accent)" /> : <p className="muted" style={{ margin: 0, fontSize: 13 }}>No row where you clearly win on the evidence in the notes.</p>}
        </Card>
        <Card title={`Where ${comp.name} genuinely wins`} sub="Don't argue these, reframe" titleColor="var(--color-bad)">
          {loses.length ? <Bullets items={loses} color="var(--color-bad)" /> : <p className="muted" style={{ margin: 0, fontSize: 13 }}>No row where they clearly win on the evidence in the notes.</p>}
        </Card>
        <Card title="Objection handling" sub="What the buyer says, what we say">
          {card?.objections.length ? (
            <>
              {card.objections.map((o, i) => (
                <div key={i} className="quote-card">
                  <b>“{o.objection}”</b>{o.response}
                  <div className="kicker" style={{ marginTop: 4 }}>{comparison.fields.find((f) => f.id === o.field_id)?.label ?? o.field_id}</div>
                </div>
              ))}
              <p className="muted" style={{ margin: 0, fontSize: 11 }}>Drafted by Claude from the compared values only · {fmtDate(card.generated_at)}</p>
            </>
          ) : toPrepare.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing to prepare: no row where {comp.name} looks stronger or where your notes are silent.</p>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{toPrepare.length} row{toPrepare.length === 1 ? "" : "s"} worth preparing: {toPrepare.map((r) => r.f.label).join(", ")}.</p>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={!done || busy || toPrepare.length === 0} onClick={draft}
              title={done ? undefined : "Available after a completed run"}>
              {busy ? "Drafting…" : card ? "Redraft with Claude" : "Draft with Claude"}
            </button>
            {err && <span className="bad" style={{ fontSize: 11 }}>{err}</span>}
          </div>
        </Card>
        <Card title="Gaps to close" sub="What the notes can't settle — never guessed">
          {ties.length > 0 && (
            <p style={{ margin: "0 0 6px", fontSize: 13 }}><b>Even:</b> {ties.map((r) => r.f.label).join(", ")}</p>
          )}
          {gaps.length ? (
            <ul className="bullets">
              {gaps.map((r) => (
                <li key={r.f.id} style={{ cursor: "pointer" }} onClick={() => onSelect({ entityId: r.y.status === "missing" ? you.id : comp.id, fieldId: r.f.id })}>
                  <span className="dot muted" />
                  <span><b>{r.f.label}.</b>{" "}
                    {r.y.status === "missing" && <span>{you.name}: not in your notes → confirm internally. </span>}
                    {r.t.status === "missing" && <span>{comp.name}: not in their notes → research. </span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="muted" style={{ margin: 0, fontSize: 13 }}>Every compared row has data on both sides.</p>}
          {source && fresh && (
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 11, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span>Source on this card: {source.title} · {KIND_LABEL[source.kind]} · <span className={levelClass[fresh.level]}>captured {fmtDate(source.captured_at)} ({fresh.label})</span></span>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "0 4px" }} onClick={onOpenSources}>Review sources →</button>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
