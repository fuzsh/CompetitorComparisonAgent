"use client";
export type TabId = "overview" | "battlecards" | "sources" | "details";
const TABS: [TabId, string][] = [["overview", "Overview"], ["battlecards", "Battlecards"], ["sources", "Sources & inputs"], ["details", "Full details"]];

export default function Tabs({ tab, onTab, disabled }: { tab: TabId; onTab: (t: TabId) => void; disabled: TabId[] }) {
  return (
    <div className="tabs" role="tablist">
      {TABS.map(([id, label]) => (
        <button key={id} role="tab" type="button" className="tab" aria-selected={tab === id} disabled={disabled.includes(id)}
          title={disabled.includes(id) ? "Generate a comparison first" : undefined} onClick={() => onTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
