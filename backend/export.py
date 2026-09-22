"""Skill 7, rendering-tables: deterministic Markdown / CSV / HTML / PPTX exports of a Comparison."""
import csv
import html
import io

from .models import Cell, Comparison

ICON = {"win": "✅", "lose": "❌", "tie": "➖", "n/a": "⚪"}
FILL = {"win": "D1FAE5", "lose": "FEE2E2", "tie": "F3F4F6", "n/a": "F3F4F6"}


def cell_text(c: Cell) -> str:
    return "— missing" if c.status == "missing" else f"{c.display_value} [{c.status}]"


def grid(c: Comparison) -> tuple[list[str], list[list[str]], list[list[str | None]]]:
    """header, rows, and a parallel matrix of verdict kinds (None for non-competitor columns)."""
    cells = {(x.entity_id, x.field_id): x for x in c.cells}
    verdicts = {(v.entity_id, v.field_id): v for v in c.verdicts}
    you = next(e for e in c.entities if e.is_your_company)
    comps = [e for e in c.entities if not e.is_your_company]
    header = ["Field", f"{you.name} (You)"] + [h for e in comps for h in (e.name, f"Verdict vs {e.name}")]
    rows, kinds = [], []
    for f in c.fields:
        row, kind = [f.label, cell_text(cells[(you.id, f.id)])], [None, None]
        for e in comps:
            v = verdicts.get((e.id, f.id))
            row += [cell_text(cells[(e.id, f.id)]), f"{ICON[v.verdict]} {v.verdict}: {v.rationale}" if v else ""]
            kind += [None, v.verdict if v else None]
        rows.append(row)
        kinds.append(kind)
    return header, rows, kinds


def markdown(c: Comparison) -> str:
    header, rows, _ = grid(c)
    esc = lambda s: s.replace("|", "\\|").replace("\n", " ")
    lines = ["| " + " | ".join(map(esc, header)) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(map(esc, r)) + " |" for r in rows]
    return "\n".join(lines) + "\n"


def csv_(c: Comparison) -> str:
    header, rows, _ = grid(c)
    safe = lambda s: ("'" + s) if s.lstrip()[:1] in ("=", "+", "-", "@") else s  # CSV-injection guard
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    for r in rows:
        w.writerow([safe(x) for x in r])
    return buf.getvalue()


def html_(c: Comparison) -> str:
    header, rows, kinds = grid(c)
    css = ("body{font:14px system-ui,sans-serif;margin:24px}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px;"
           "vertical-align:top}th{background:#f3f4f6}" + "".join(f".{k.replace('/', '')}{{background:#{v}}}" for k, v in FILL.items()))
    out = [f"<!doctype html><meta charset='utf-8'><title>Competitor comparison</title><style>{css}</style><table><tr>"]
    out += [f"<th>{html.escape(h)}</th>" for h in header] + ["</tr>"]
    for r, k in zip(rows, kinds):
        out.append("<tr>" + "".join(f"<td class='{(kk or '').replace('/', '')}'>{html.escape(x)}</td>" for x, kk in zip(r, k)) + "</tr>")
    return "".join(out) + "</table>"


def pptx_(c: Comparison) -> bytes:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Inches, Pt

    header, rows, kinds = grid(c)
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[5])
    slide.shapes.title.text = "Competitor comparison"
    n_rows, n_cols = len(rows) + 1, len(header)
    table = slide.shapes.add_table(n_rows, n_cols, Inches(0.3), Inches(1.3), Inches(12.7), Inches(0.35 * n_rows)).table
    for j, h in enumerate(header):
        table.cell(0, j).text = h
    for i, (r, k) in enumerate(zip(rows, kinds), start=1):
        for j, (x, kk) in enumerate(zip(r, k)):
            cell = table.cell(i, j)
            cell.text = x
            if kk:
                cell.fill.solid()
                cell.fill.fore_color.rgb = RGBColor.from_string(FILL[kk])
    for row in table.rows:
        for cell in row.cells:
            for p in cell.text_frame.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def render(c: Comparison, fmt: str) -> tuple[bytes, str, str]:
    """-> (body, media_type, extension)"""
    if fmt == "markdown":
        return markdown(c).encode(), "text/markdown; charset=utf-8", "md"
    if fmt == "csv":
        return csv_(c).encode(), "text/csv; charset=utf-8", "csv"
    if fmt == "html":
        return html_(c).encode(), "text/html; charset=utf-8", "html"
    return pptx_(c), "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"
