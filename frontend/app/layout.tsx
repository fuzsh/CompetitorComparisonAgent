import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Competitor Comparison Table",
  description: "Turns rough competitor notes into a traceable comparison table: quotes for every cell, inferences labeled, gaps flagged.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">{children}</body>
    </html>
  );
}
