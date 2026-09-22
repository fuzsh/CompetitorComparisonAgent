"use client";
import { useState } from "react";
import { exportComparison } from "@/lib/api";

export default function ExportBar({ id, disabled }: { id: string; disabled?: boolean }) {
  const [msg, setMsg] = useState("");
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };
  const download = async (format: "csv" | "html" | "pptx") => {
    try {
      const url = URL.createObjectURL(await exportComparison(id, format));
      const a = Object.assign(document.createElement("a"), { href: url, download: `comparison.${format}` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { flash(String((e as Error).message ?? e)); }
  };
  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(await (await exportComparison(id, "markdown")).text());
      flash("Markdown copied to clipboard");
    } catch (e) { flash(String((e as Error).message ?? e)); }
  };
  const btn = "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} disabled={disabled} onClick={copyMd}>Copy as Markdown</button>
      <button className={btn} disabled={disabled} onClick={() => download("csv")}>Download CSV</button>
      <button className={btn} disabled={disabled} onClick={() => download("html")}>Download HTML</button>
      <button className={btn} disabled={disabled} onClick={() => download("pptx")}>Download PPTX slide</button>
      {msg && <span className="text-xs text-emerald-600">{msg}</span>}
    </div>
  );
}
