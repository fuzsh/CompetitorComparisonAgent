"use client";
import { useState } from "react";
import { exportComparison } from "@/lib/api";

export default function ExportBar({ id, disabled }: { id: string; disabled?: boolean }) {
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  const download = async (format: "csv" | "html" | "pptx") => {
    try {
      const url = URL.createObjectURL(await exportComparison(id, format));
      Object.assign(document.createElement("a"), { href: url, download: `comparison.${format}` }).click();
      URL.revokeObjectURL(url);
    } catch (e) { flash(String((e as Error).message ?? e)); }
  };
  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(await (await exportComparison(id, "markdown")).text());
      flash("Markdown copied");
    } catch (e) { flash(String((e as Error).message ?? e)); }
  };
  const s = { fontSize: 12 } as const;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <button type="button" className="btn btn-secondary" style={s} disabled={disabled} onClick={copyMd}>Copy Markdown</button>
      <button type="button" className="btn btn-secondary" style={s} disabled={disabled} onClick={() => download("csv")}>CSV</button>
      <button type="button" className="btn btn-secondary" style={s} disabled={disabled} onClick={() => download("html")}>HTML</button>
      <button type="button" className="btn btn-primary" style={s} disabled={disabled} onClick={() => download("pptx")}>PPTX slide</button>
      {msg && <span className="muted" style={{ fontSize: 11 }}>{msg}</span>}
    </div>
  );
}
