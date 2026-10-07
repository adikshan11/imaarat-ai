"""Form-reading benchmark: the app's Gemini reader, Sarvam Extract and Qwen3-VL on the same rendered forms, scored with the app's own field checks."""

import base64
import json
import os
import re
import statistics
import sys
import time
from pathlib import Path

import httpx
from app import budget
from app.tools import form_reader

LABELS = {
    "zip": "PIN code, 6 digits",
    "address": "Address",
    "city": "City",
    "state": "State",
    "occupancy_type": "Occupancy",
    "construction_type": "Construction type",
    "year_built": "Year built",
    "num_stories": "Floors",
    "square_footage": "Built-up area in sq ft",
    "roof_age_years": "Roof age in years",
    "prior_claims_count_5yr": "Claims in the last 5 years",
    "cat_zone": "Main natural hazard",
    "seismic_zone": "Seismic zone (IS 1893)",
    "sprinkler_system": "Sprinklers",
    "fire_alarm": "Fire alarm",
    "flood_protection": "Flood protection",
    "building_value_inr": "Building value in rupees",
    "plant_machinery_value_inr": "Plant and machinery value in rupees",
    "stock_inventory_value_inr": "Stock value in rupees",
    "other_contents_value_inr": "Other contents value in rupees",
}
GROUPS = {
    "digits": ["zip", "year_built", "num_stories", "square_footage", "roof_age_years", "prior_claims_count_5yr"],
    "money": ["building_value_inr", "plant_machinery_value_inr", "stock_inventory_value_inr", "other_contents_value_inr"],
    "text": ["address", "city", "state", "occupancy_type"],
    "choices": ["construction_type", "cat_zone", "seismic_zone"],
    "ticks": ["sprinkler_system", "fire_alarm", "flood_protection"],
}
LANGUAGE_CODES = {"en": "en-IN", "hi": "hi-IN", "ta": "ta-IN", "bn": "bn-IN", "te": "te-IN", "ml": "ml-IN", "gu": "gu-IN"}
QWEN_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct:cheapest"


def instruction(name: str) -> str:
    extra = ""
    if name in form_reader.TICK_FIELDS:
        extra = " Answer yes or no from the English word printed with the ticked box."
    elif name in form_reader.CHOICE_FIELDS:
        extra = " Give the English option name printed with the ticked box, one of: " + ", ".join(form_reader.CHOICE_FIELDS[name]) + "."
    return f"{LABELS[name]}. Copy exactly what is handwritten; leave empty if blank.{extra}"


def same(left: object, right: object) -> bool:
    if left is None or right is None:
        return left is None and right is None
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return float(left) == float(right)
    return re.sub(r"\s+", " ", str(left)).strip().casefold() == re.sub(r"\s+", " ", str(right)).strip().casefold()


def checked(raw: dict) -> dict:
    return {name: form_reader.check(name, None if raw.get(name) in ("", None) else str(raw.get(name)))[0] for name in form_reader.FIELDS}


def read_gemini(image: bytes, lang: str) -> dict:
    reading = form_reader.read_form(image, "image/jpeg")
    return {name: field["value"] for name, field in reading["fields"].items()}


def read_sarvam(image: bytes, lang: str) -> dict:
    from sarvamai import SarvamAI

    client = SarvamAI(api_subscription_key=os.environ["SARVAM_API_KEY"])
    schema = {"type": "object", "properties": {name: {"type": "string", "description": instruction(name)} for name in form_reader.FIELDS}}
    job = client.doc_ai.extract(file=[("form.jpg", image, "image/jpeg")], schema=json.dumps(schema), language=LANGUAGE_CODES[lang], output_format="json")
    for _ in range(90):
        status = client.doc_ai.get_status(job_id=job.job_id).status
        if status in ("completed", "partially_completed", "failed", "rejected"):
            break
        time.sleep(2)
    if status not in ("completed", "partially_completed"):
        raise RuntimeError(f"sarvam job {status}")
    result = client.doc_ai.get_results(job_id=job.job_id, format="json").result
    return checked(result)


def read_qwen(image: bytes, lang: str) -> dict:
    keys = ", ".join(f'"{name}" ({instruction(name)})' for name in form_reader.FIELDS)
    response = httpx.post(
        "https://router.huggingface.co/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.environ['HF_TOKEN']}"},
        json={
            "model": QWEN_MODEL,
            "temperature": 0,
            "messages": [
                {"role": "system", "content": form_reader.SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Return only one JSON object with these keys, each a string or null: {keys}"},
                        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(image).decode()}},
                    ],
                },
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"]
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return checked(json.loads(match.group(0)) if match else {})


READERS = {"gemini": read_gemini, "sarvam": read_sarvam, "qwen": read_qwen}
SPACING = {"gemini": 13, "sarvam": 7, "qwen": 2}


def main() -> int:
    cases_path, images_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
    providers = sys.argv[4].split(",") if len(sys.argv) > 4 else list(READERS)
    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    tokens_before = budget.remaining()["tokens_today"]
    for provider in providers:
        for case in cases:
            if provider == "gemini" and not os.getenv("GEMINI_ALL_FORMS") and not case["id"].endswith("-1"):
                continue
            truth = checked(case["values"])
            started = time.perf_counter()
            try:
                predicted, error = READERS[provider]((images_dir / f"{case['id']}.jpg").read_bytes(), case["lang"]), None
            except Exception as failure:
                predicted, error = {}, f"{type(failure).__name__}: {str(failure)[:160]}"
            latency = round((time.perf_counter() - started) * 1000)
            for name in form_reader.FIELDS:
                rows.append(
                    {
                        "provider": provider,
                        "case": case["id"],
                        "lang": case["lang"],
                        "field": name,
                        "expected": truth[name],
                        "got": predicted.get(name),
                        "correct": same(truth[name], predicted.get(name)),
                        "latency_ms": latency,
                        "error": error,
                    }
                )
            print(f"{provider} {case['id']} {latency} ms {error or ''}", flush=True)
            time.sleep(SPACING[provider])
    tokens_after = budget.remaining()["tokens_today"]
    (out_dir / "forms_rows.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    summary = summarise(rows, providers, {"gemini_tokens": {key: tokens_after[key] - tokens_before[key] for key in tokens_after}})
    (out_dir / "forms_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "forms_summary.md").write_text(markdown(summary, rows), encoding="utf-8")
    print(markdown(summary, rows))
    return 0


def rate(rows: list[dict]) -> float | None:
    return round(sum(row["correct"] for row in rows) / len(rows), 3) if rows else None


def summarise(rows: list[dict], providers: list[str], extra: dict) -> dict:
    result = {"forms": len({row["case"] for row in rows}), "fields_per_form": len(form_reader.FIELDS), **extra, "providers": {}}
    for provider in providers:
        mine = [row for row in rows if row["provider"] == provider]
        filled_wrong = [row for row in mine if row["got"] is not None and not row["correct"]]
        latencies = sorted({(row["case"], row["latency_ms"]) for row in mine})
        values = [latency for _, latency in latencies]
        result["providers"][provider] = {
            "field_accuracy": rate(mine),
            "filled_but_wrong": round(len(filled_wrong) / len(mine), 3) if mine else None,
            "forms_fully_correct": sum(all(row["correct"] for row in mine if row["case"] == case) for case in {row["case"] for row in mine}),
            "failed_forms": len({row["case"] for row in mine if row["error"]}),
            "by_group": {group: rate([row for row in mine if row["field"] in fields]) for group, fields in GROUPS.items()},
            "by_language": {lang: rate([row for row in mine if row["lang"] == lang]) for lang in sorted({row["lang"] for row in mine})},
            "latency_p50_ms": round(statistics.median(values)) if values else None,
            "latency_p95_ms": round(statistics.quantiles(values, n=20)[18]) if len(values) >= 2 else (values[0] if values else None),
        }
    return result


def markdown(summary: dict, rows: list[dict]) -> str:
    providers = list(summary["providers"])
    lines = [
        f"## Form reading: {summary['forms']} rendered forms x {summary['fields_per_form']} fields",
        "",
        "Synthetic handwriting fonts on the app's own printed form, photo-like blur and tilt. Fonts flatter every reader; real handwriting will score lower.",
        "Gemini reads one form per language (7 forms) to stay within its free tier of 20 requests a day, unless GEMINI_ALL_FORMS is set.",
        "",
        "| Metric | " + " | ".join(providers) + " |",
        "|---|" + "---:|" * len(providers),
    ]
    metric_rows = [
        ("Field accuracy", "field_accuracy"),
        ("Filled but wrong", "filled_but_wrong"),
        ("Forms fully correct", "forms_fully_correct"),
        ("Failed forms", "failed_forms"),
        ("Latency p50 ms", "latency_p50_ms"),
        ("Latency p95 ms", "latency_p95_ms"),
    ]
    for label, key in metric_rows:
        lines.append(f"| {label} | " + " | ".join(str(summary["providers"][provider][key]) for provider in providers) + " |")
    for group in GROUPS:
        lines.append(f"| {group} | " + " | ".join(str(summary["providers"][provider]["by_group"][group]) for provider in providers) + " |")
    for lang in sorted({row["lang"] for row in rows}):
        lines.append(f"| lang {lang} | " + " | ".join(str(summary["providers"][provider]["by_language"].get(lang)) for provider in providers) + " |")
    lines += ["", f"Gemini tokens during the run: {summary.get('gemini_tokens')}", "", "### First errors per provider", "", "| Provider | Form | Field | Expected | Got |", "|---|---|---|---|---|"]
    for provider in providers:
        for row in [row for row in rows if row["provider"] == provider and not row["correct"]][:12]:
            lines.append(f"| {provider} | {row['case']} | {row['field']} | {row['expected']} | {row['got']} |")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
