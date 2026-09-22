"use client";
import { useEffect, useState } from "react";

export type Theme = "light" | "system" | "dark";
const THEMES: Theme[] = ["light", "system", "dark"];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as Theme | null;
      if (saved && THEMES.includes(saved)) setTheme(saved);
    } catch {}
  }, []);

  useEffect(() => {
    apply(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (theme === "system") apply("system"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const choose = (t: Theme) => {
    setTheme(t);
    try { localStorage.setItem("theme", t); } catch {}
  };

  return (
    <div role="group" aria-label="Theme" className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-700">
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          onClick={() => choose(t)}
          className={`px-2.5 py-1 capitalize ${theme === t ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
        >
          {t === "light" ? "☀ light" : t === "dark" ? "☾ dark" : "system"}
        </button>
      ))}
    </div>
  );
}
