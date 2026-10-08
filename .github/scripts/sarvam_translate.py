"""Translate English UI strings with Sarvam into every locale it supports and report them beside the current text."""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

LOCALES = Path(__file__).resolve().parents[2] / "frontend" / "src" / "i18n" / "locales"
CODES = {"as": "as-IN", "bn": "bn-IN", "brx": "brx-IN", "doi": "doi-IN", "gom": "kok-IN", "gu": "gu-IN", "hi": "hi-IN", "kn": "kn-IN", "ks": "ks-IN", "mai": "mai-IN", "ml": "ml-IN", "mni": "mni-IN", "mr": "mr-IN", "ne": "ne-IN", "or": "od-IN", "pa": "pa-IN", "sa": "sa-IN", "sat": "sat-IN", "sd": "sd-IN", "ta": "ta-IN", "te": "te-IN", "ur": "ur-IN"}


def translate(text: str, target: str) -> str:
    body = json.dumps({"input": text, "source_language_code": "en-IN", "target_language_code": target, "model": "sarvam-translate:v1"}).encode()
    headers = {"api-subscription-key": os.environ["SARVAM_API_KEY"], "Content-Type": "application/json"}
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request("https://api.sarvam.ai/translate", data=body, headers=headers), timeout=60) as response:
                return json.load(response)["translated_text"]
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    return ""


def main() -> int:
    keys = sys.argv[1].split(",")
    english = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    results = {}
    for code, target in CODES.items():
        current = json.loads((LOCALES / f"{code}.json").read_text(encoding="utf-8"))
        results[code] = {key: {"sarvam": translate(english[key], target), "current": current[key]} for key in keys}
    Path("translations.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print("| Locale | Key | Sarvam | Current |\n|---|---|---|---|")
    for code, rows in results.items():
        for key, row in rows.items():
            print(f"| {code} | {key} | {row['sarvam']} | {row['current']} |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
