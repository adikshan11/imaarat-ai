"""Download public PDFs and write their text page by page, so sources can be read and cited from a CI artifact."""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from pypdf import PdfReader


def fetch(url: str, path: Path) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (imaarat source review)"})  # noqa: S310 - URLs come from the workflow input
    try:
        with urllib.request.urlopen(request, timeout=180) as response:  # noqa: S310 - URLs come from the workflow input
            path.write_bytes(response.read())
    except urllib.error.HTTPError as error:
        return f"http {error.code}"
    except urllib.error.URLError as error:
        return f"failed {error.reason}"
    return "ok" if path.read_bytes()[:4] == b"%PDF" else "not a pdf"


def main(urls: list[str], out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for number, url in enumerate(urls, start=1):
        pdf = out / f"{number:02d}.pdf"
        status = fetch(url, pdf)
        pages = 0
        if status == "ok":
            reader = PdfReader(pdf)
            pages = len(reader.pages)
            text = "\n".join(f"=== page {index} ===\n{page.extract_text() or ''}" for index, page in enumerate(reader.pages, start=1))
            (out / f"{number:02d}.txt").write_text(text, encoding="utf-8")
        pdf.unlink(missing_ok=True)
        manifest.append({"file": f"{number:02d}.txt", "url": url, "status": status, "pages": pages})
        print(f"{number:02d} {status} {pages} pages {url[:120]}")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[2:], Path(sys.argv[1]))
