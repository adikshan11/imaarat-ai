from __future__ import annotations

from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as ReportImage
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import BASE_DIR

GREEN = colors.HexColor("#0d4838")
TINT = colors.HexColor("#eaf6ee")
LINE = colors.HexColor("#c9d6cf")
MUTED = colors.HexColor("#5b6b64")
WIDTH = 178 * mm

DECISIONS = {
    "Accept": ("Accept", "Within appetite at standard terms.", "#e3f6e8"),
    "Refer": ("Refer", "Needs a senior underwriter's approval.", "#fdf3d8"),
    "Decline (mitigation possible)": ("Decline unless risk is reduced", "Decline unless the listed risk improvements are made.", "#fde6d2"),
    "Auto-Decline": ("Auto-decline", "Outside appetite.", "#fbdcdc"),
}
FLAGS = {
    "roof_replacement_likely": "Roof likely needs replacement",
    "aging_roof": "Ageing roof",
    "combustible_construction": "Combustible construction",
    "no_sprinkler_high_hazard_occupancy": "No sprinklers in a high-hazard occupancy",
    "high_cat_zone_exposure": "High natural-catastrophe exposure",
    "moderate_cat_zone_captured": "Moderate natural-catastrophe exposure",
    "high_seismic_zone": "High seismic zone",
    "coastal_wind_surge_exposure": "Coastal wind and surge exposure",
    "wildland_urban_interface": "Near a forest",
    "adverse_loss_history": "Adverse claims history",
    "high_tiv_concentration": "High sum insured at one location",
    "declared_seismic_zone_below_official": "Declared seismic zone below the official zone",
    "flood_history_at_pincode": "Flood history at this PIN code",
    "imd_cyclone_prone_district": "IMD cyclone-prone district",
    "nrsc_landslide_district": "NRSC landslide-ranked district",
}
FACTORS = {
    "roof_age": "Roof age",
    "construction": "Construction",
    "sprinkler": "Sprinklers",
    "cat_zone": "Natural catastrophe",
    "seismic_zone": "Seismic zone",
    "coastal": "Coastal exposure",
    "wildland": "Forest fire",
    "loss_history": "Claims history",
    "tiv": "Sum insured",
}

base = getSampleStyleSheet()
body = ParagraphStyle("body", parent=base["Normal"], fontSize=9.5, leading=13)
cell = ParagraphStyle("cell", parent=body, fontSize=9, leading=11.5)
cell_bold = ParagraphStyle("cell_bold", parent=cell, fontName="Helvetica-Bold")
cell_white = ParagraphStyle("cell_white", parent=cell_bold, textColor=colors.white)
heading = ParagraphStyle("heading", parent=base["Heading2"], fontSize=13, leading=16, textColor=GREEN, spaceBefore=12, spaceAfter=5)
title = ParagraphStyle("title", parent=base["Title"], fontSize=19, leading=23, textColor=GREEN, alignment=0, spaceAfter=2)
muted = ParagraphStyle("muted", parent=body, fontSize=8.5, leading=11, textColor=MUTED)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=12, bulletIndent=2, spaceAfter=2)


def plain(value: Any) -> str:
    if value is None or value == "":
        return "Not provided"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, list):
        return "; ".join(plain(item) for item in value)
    if isinstance(value, dict):
        return "; ".join(f"{key.replace('_', ' ').capitalize()}: {plain(item)}" for key, item in value.items())
    return str(value)


def para(value: Any, style: ParagraphStyle = cell) -> Paragraph:
    return Paragraph(escape(plain(value)), style)


def inr(value: Any) -> str:
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return plain(value)
    digits = str(abs(number))
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return f"{'-' if number < 0 else ''}INR {','.join([*groups, tail])}"


def label(code: Any, names: dict[str, str]) -> str:
    return names.get(str(code), str(code).replace("_", " ").capitalize())


def facts_table(rows: list[tuple[str, Any]]) -> Table:
    table = Table([[para(name, cell_bold), para(value)] for name, value in rows], colWidths=[52 * mm, WIDTH - 52 * mm])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.25, LINE), ("BACKGROUND", (0, 0), (0, -1), TINT), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return table


def bullets(story: list[Any], items: list[Any]) -> None:
    for item in items:
        story.append(Paragraph(escape(plain(item)), bullet, bulletText="•"))


def section(story: list[Any], name: str, items: list[Any] | str | None) -> None:
    if not items:
        return
    story.append(Paragraph(name, heading))
    if isinstance(items, str):
        story.append(Paragraph(escape(items), body))
    else:
        bullets(story, items)


def submitted_image_path(submission: dict[str, Any]) -> Path | None:
    raw_path = submission.get("image_path")
    if not raw_path:
        return None
    path = Path(str(raw_path))
    if not path.is_absolute():
        path = BASE_DIR / path
    return path if path.is_file() else None


def page_footer(canvas: Any, document: Any) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(16 * mm, 9 * mm, "imaarat.ai  |  Rules decide, AI explains, a person approves")
    canvas.drawRightString(A4[0] - 16 * mm, 9 * mm, f"Page {document.page}")
    canvas.restoreState()


def decision_banner(submission: dict[str, Any]) -> Table:
    name, meaning, tint = DECISIONS.get(str(submission.get("decision")), (plain(submission.get("decision")), "", "#eef2f0"))
    left = Paragraph(f"<font size='15'><b>{escape(name)}</b></font><br/>{escape(meaning)}", body)
    right = Paragraph(f"<font size='20'><b>{escape(plain(submission.get('risk_score')))}</b></font> / 100<br/>Risk score, higher is riskier", body)
    table = Table([[left, right]], colWidths=[WIDTH * 0.62, WIDTH * 0.38])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(tint)),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def breakdown_table(breakdown: dict[str, Any]) -> Table:
    rows = [[para("Factor", cell_white), para("Points", cell_white)]]
    total = 0.0
    for factor, points in breakdown.items():
        rows.append([para(label(factor, FACTORS)), para(points)])
        total += float(points) if isinstance(points, int | float) else 0
    rows.append([para("Total", cell_bold), para(int(total) if total.is_integer() else round(total, 1), cell_bold)])
    table = Table(rows, colWidths=[WIDTH * 0.7, WIDTH * 0.3], repeatRows=1)
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.25, LINE), ("BACKGROUND", (0, 0), (-1, 0), GREEN), ("BACKGROUND", (0, -1), (-1, -1), TINT)]))
    return table


def references_table(comps: list[dict[str, Any]]) -> Table:
    keys = [
        ("property_id", "Property"),
        ("city", "City"),
        ("state", "State"),
        ("construction_type", "Construction"),
        ("occupancy_type", "Occupancy"),
        ("cat_zone", "CAT zone"),
        ("year_built", "Built"),
        ("tiv", "Value"),
    ]
    rows = [[para(name, cell_white) for _, name in keys]]
    rows += [[para(inr(comp.get(key)) if key == "tiv" else comp.get(key)) for key, _ in keys] for comp in comps]
    widths = [32 * mm, 22 * mm, 22 * mm, 26 * mm, 24 * mm, 16 * mm, 12 * mm, 24 * mm]
    table = Table(rows, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.25, LINE),
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7faf8")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def build_submission_pdf(submission: dict[str, Any]) -> bytes:
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=16 * mm, bottomMargin=18 * mm, title="Commercial property underwriting report")
    raw = submission.get("raw_input", {})
    features = submission.get("extracted_features", {})
    memo = submission.get("memo_json") or {}
    flags = submission.get("risk_flags") or []

    story: list[Any] = [
        Paragraph("Commercial property underwriting report", title),
        Paragraph(f"Report date {date.today().isoformat()}  |  Submission date {raw.get('submission_date') or date.today().isoformat()}", muted),
        Spacer(1, 8),
        decision_banner(submission),
        Paragraph("Property", heading),
    ]
    address = ", ".join(str(part) for part in (raw.get("address"), raw.get("city"), raw.get("state"), raw.get("zip")) if part)
    story.append(
        facts_table(
            [
                ("Property ID", submission.get("property_id")),
                ("Address", address),
                ("Occupancy", raw.get("occupancy_type")),
                ("Construction", raw.get("construction_type")),
                ("Total value at risk", inr(submission.get("total_value_at_risk_inr")) if submission.get("total_value_at_risk_inr") else None),
                ("Policy segment", raw.get("policy_type") or submission.get("policy_type")),
            ]
        )
    )
    section(story, "Summary", memo.get("property_summary"))

    story.append(Paragraph("Why this decision", heading))
    story.append(Paragraph("Risk flags raised by the rules", cell_bold))
    story.append(Spacer(1, 3))
    if flags:
        bullets(story, [label(flag, FLAGS) for flag in flags])
    else:
        story.append(Paragraph("No risk flags were raised.", body))
    breakdown = submission.get("risk_breakdown") or {}
    if breakdown:
        story.append(Spacer(1, 6))
        story.append(KeepTogether([Paragraph("How the score was built", cell_bold), Spacer(1, 3), breakdown_table(breakdown)]))

    section(story, "Key risk factors", memo.get("key_risk_factors"))
    section(story, "Coverage review", memo.get("coverage_review"))
    section(story, "Rationale", memo.get("rationale"))
    if memo.get("suggested_next_steps"):
        section(story, "Suggested next steps", memo["suggested_next_steps"])
    elif not memo:
        section(
            story,
            "Suggested next steps",
            f"The AI summary was not available ({plain(submission.get('ai_memo_reason'))}). The decision above comes from the rules alone. Review the risk flags and the guideline evidence before acting.",
        )

    if features.get("image_status"):
        story.append(Paragraph("Property photo", heading))
        rows = [("Photo check", features.get("image_status")), ("Reason", features.get("image_reason")), ("Used in the score", features.get("image_risk_evidence_used"))]
        for key in ("visible_roof_condition", "visible_structural_damage", "general_maintenance_level", "visible_hazards"):
            value = features.get(key)
            if value and str(value).lower() not in ("not visible", "none", ""):
                rows.append((key.replace("_", " ").capitalize(), value))
        story.append(facts_table(rows))
        submitted_image = submitted_image_path(submission)
        if submitted_image is not None:
            report_image = ReportImage(str(submitted_image))
            scale = min(WIDTH / report_image.imageWidth, 90 * mm / report_image.imageHeight, 1)
            report_image.drawWidth = report_image.imageWidth * scale
            report_image.drawHeight = report_image.imageHeight * scale
            story.append(Spacer(1, 5))
            story.append(report_image)
            story.append(Paragraph("What the photo shows is a reading by AI, not a verified fact about the property.", muted))

    chunks = [str(chunk) for chunk in submission.get("guideline_chunks", []) if chunk and str(chunk).strip()]
    section(story, "Guidelines used", [chunk[:220] + ("..." if len(chunk) > 220 else "") for chunk in chunks])

    comps = [comp for comp in submission.get("comparables", []) if isinstance(comp, dict)]
    story.append(Paragraph("Reference properties", heading))
    story.append(Paragraph("Synthetic reference data for context. These are not verified market comparables.", muted))
    story.append(Spacer(1, 3))
    story.append(references_table(comps) if comps else Paragraph("No reference properties available.", body))
    document.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    return buffer.getvalue()
