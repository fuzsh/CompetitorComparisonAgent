"""Small deterministic text helpers shared by the pipeline and the optional Jev attachment."""
import os
import re
from pathlib import Path

SENT = re.compile(r"[^.!?\n]+[.!?]*['\")\]]*")
QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'})


def sentences(text: str) -> list[tuple[int, int, str]]:
    """Split into (start, end, text) spans whose offsets index the ORIGINAL string."""
    out = []
    for m in SENT.finditer(text):
        raw = m.group()
        lead = len(raw) - len(raw.lstrip())
        body = raw.strip()
        if body:
            start = m.start() + lead
            out.append((start, start + len(body), body))
    return out


def find_quote(source: str, quote: str) -> tuple[int, int] | None:
    """Exact substring first; then whitespace/case/curly-quote-insensitive. Returns a span in source coordinates."""
    i = source.find(quote)
    if i >= 0:
        return i, i + len(quote)
    tokens = quote.translate(QUOTES).split()
    if not tokens:
        return None
    rx = re.compile(r"\s+".join(re.escape(t) for t in tokens), re.IGNORECASE)
    m = rx.search(source.translate(QUOTES))
    return (m.start(), m.end()) if m else None


def trim(s: str, n: int = 90) -> str:
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def load_dotenv(path: str | Path = ".env") -> None:
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
