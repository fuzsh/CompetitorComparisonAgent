"""Deterministic price/number parsing and comparison. Jev is not a calculator; all arithmetic lives here."""
import re
from dataclasses import dataclass

CURRENCIES = {"$": "USD", "€": "EUR", "£": "GBP", "usd": "USD", "eur": "EUR", "gbp": "GBP"}
SYMBOL = {"USD": "$", "EUR": "€", "GBP": "£"}
_CUR = r"[$€£]|\b(?:USD|EUR|GBP)\b"
AMOUNT = re.compile(
    rf"(?P<pre>{_CUR})?\s?(?P<num>\d{{1,3}}(?:,\d{{3}})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(?P<post>{_CUR})?", re.I
)
# (name, regex, months-per-period factor to convert to per-month; None = one-time)
PERIODS = [
    ("month", re.compile(r"\b(?:month|mo|monthly)\b", re.I), 1.0),
    ("year", re.compile(r"\b(?:year|yr|annual|annually|per annum)\b", re.I), 1 / 12),
    ("week", re.compile(r"\b(?:week|wk|weekly)\b", re.I), 52 / 12),
    ("one-time", re.compile(r"\b(?:one[- ]time|lifetime|once)\b", re.I), None),
]
WINDOW = 40  # chars after the amount to look for a period keyword


@dataclass
class Price:
    amount: float
    currency: str
    period: str  # month | year | week | one-time | unspecified
    per_month: float | None
    raw: str

    def fmt(self) -> str:
        s = f"{SYMBOL.get(self.currency, self.currency + ' ')}{self.amount:g}"
        if self.period == "unspecified":
            return s
        if self.period == "one-time":
            return f"{s} one-time"
        if self.period != "month" and self.per_month is not None:
            return f"{s}/{self.period} (≈{SYMBOL.get(self.currency, '')}{self.per_month:.2f}/month)"
        return f"{s}/{self.period}"


def parse_prices(text: str) -> list[Price]:
    out: list[Price] = []
    for m in AMOUNT.finditer(text):
        cur = m.group("pre") or m.group("post")
        if not cur:
            continue
        amount = float(m.group("num").replace(",", ""))
        window = text[m.end(): m.end() + WINDOW]
        best = None
        for name, rx, factor in PERIODS:
            pm = rx.search(window)
            if pm and (best is None or pm.start() < best[0]):
                best = (pm.start(), name, factor)
        # ponytail: no period keyword -> assume monthly; "billed annually at $120" style is not handled
        period, factor = (best[1], best[2]) if best else ("unspecified", 1.0)
        per_month = None if factor is None else round(amount * factor, 4)
        out.append(Price(amount, CURRENCIES[cur.lower()], period, per_month, m.group().strip()))
    return out


def first_number(text: str) -> float | None:
    m = re.search(r"\d+(?:,\d{3})*(?:\.\d+)?", text)
    return float(m.group().replace(",", "")) if m else None


def compare_prices(you: Price, them: Price) -> tuple[str, str]:
    """Verdict from your company's point of view for lower_is_better price rows."""
    if you.currency != them.currency:
        return "n/a", f"currency mismatch ({you.currency} vs {them.currency}); not compared"
    if you.per_month is None or them.per_month is None:
        return "n/a", "one-time vs recurring pricing; not comparable"
    rationale = f"{you.fmt()} vs {them.fmt()}"
    if you.per_month < them.per_month:
        return "win", rationale + " per month: you are cheaper"
    if you.per_month > them.per_month:
        return "lose", rationale + " per month: they are cheaper"
    return "tie", rationale + ": same price"


def compare_numbers(you: float, them: float, higher_is_better: bool, unit: str = "") -> tuple[str, str]:
    u = f" {unit}" if unit else ""
    rationale = f"{you:g}{u} vs {them:g}{u}"
    if you == them:
        return "tie", rationale + ": equal"
    you_wins = (you > them) if higher_is_better else (you < them)
    return ("win" if you_wins else "lose"), rationale


if __name__ == "__main__":  # self-check
    p = parse_prices("Pricing starts at $12/seat/month billed annually. Includes 24/7 support.")
    assert len(p) == 1 and p[0].amount == 12 and p[0].period == "month", p
    y = parse_prices("$100/year")[0]
    assert y.period == "year" and abs(y.per_month - 8.3333) < 0.01, y
    assert compare_prices(parse_prices("$8/user/mo")[0], p[0])[0] == "win"
    assert compare_prices(parse_prices("€8/month")[0], p[0])[0] == "n/a"
    assert parse_prices("24/7 onboarding") == []
    assert first_number("Battery: 12.5 hours") == 12.5
    print("numeric ok")
