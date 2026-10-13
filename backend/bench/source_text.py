"""Download public PDFs and write their text page by page, reading scanned pages with OCR, so sources can be read and cited from a CI artifact."""

import json
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from pypdf import PdfReader

MIN_TEXT_CHARACTERS = 20
OCR_DPI = 200
OCR_SECONDS = 180


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


def recognise(page) -> str:
    """Text of one scanned page, read by Tesseract."""
    with tempfile.TemporaryDirectory() as folder:
        image = Path(folder) / "page.png"
        page.get_pixmap(dpi=OCR_DPI).save(image)
        command = ["tesseract", str(image), "stdout", "-l", "eng"]
        done = subprocess.run(command, capture_output=True, text=True, timeout=OCR_SECONDS, check=False)  # noqa: S603 - fixed command on a temporary image
    return done.stdout


def page_texts(pdf: Path) -> tuple[list[str], int]:
    """Text of every page, and how many pages needed OCR because they carry no text layer."""
    texts = [page.extract_text() or "" for page in PdfReader(pdf).pages]
    scanned = [index for index, text in enumerate(texts) if len(text.strip()) < MIN_TEXT_CHARACTERS]
    if scanned and shutil.which("tesseract"):
        import pymupdf

        with pymupdf.open(pdf) as document:
            for index in scanned:
                texts[index] = recognise(document[index])
    return texts, len(scanned) if shutil.which("tesseract") else 0


def main(urls: list[str], out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for number, url in enumerate(urls, start=1):
        pdf = out / f"{number:02d}.pdf"
        status = fetch(url, pdf)
        pages = ocr_pages = 0
        if status == "ok":
            texts, ocr_pages = page_texts(pdf)
            pages = len(texts)
            (out / f"{number:02d}.txt").write_text("\n".join(f"=== page {index} ===\n{text}" for index, text in enumerate(texts, start=1)), encoding="utf-8")
        pdf.unlink(missing_ok=True)
        manifest.append({"file": f"{number:02d}.txt", "url": url, "status": status, "pages": pages, "ocr_pages": ocr_pages})
        print(f"{number:02d} {status} {pages} pages, {ocr_pages} read with OCR: {url[:120]}")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[2:], Path(sys.argv[1]))
