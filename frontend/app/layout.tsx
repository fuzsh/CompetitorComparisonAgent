import type { Metadata } from "next";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitor Comparison Table",
  description: "Turns rough competitor notes into a traceable comparison table: quotes for every cell, inferences labeled, gaps flagged.",
};

// Applies the saved theme before React hydrates so the page does not flash the wrong colors.
const themeInit = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <header className="mx-auto flex max-w-7xl justify-end px-4 pt-3 sm:px-6">
          <ThemeToggle />
        </header>
        {children}
      </body>
    </html>
  );
}
