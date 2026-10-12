"""Write MAP.md, one line per tracked source file, so agents can find code without opening files; --check fails when it is stale."""

import ast
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKIP = re.compile(r"(^MAP\.md$|^frontend/public/|^frontend/src/i18n/locales/|^backend/data/|^backend/evals/|package-lock\.json$|\.(png|webp|jpe?g|svg|ico|woff2?|pdf|csv|parquet|db)$)")
EXPORTS = re.compile(r"^export (?:default )?(?:async )?(?:function|const|class|interface|type) (\w+)", re.M)
FIRST_LINE = {".md": r"^# (.+)$", ".yml": r"^name: (.+)$", ".yaml": r"^name: (.+)$", ".sh": r"^# (.+)$", ".toml": r'^name = "(.+)"$'}


def purpose(path: Path) -> str:
    """Docstring, exported names or title of one file."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    if path.suffix == ".py":
        tree = ast.parse(text)
        doc = ast.get_docstring(tree)
        names = [node.name for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and not node.name.startswith("_")]
        return doc.splitlines()[0] if doc else ", ".join(names[:8])
    if path.suffix in (".ts", ".tsx", ".mjs", ".js"):
        return ", ".join(EXPORTS.findall(text)[:8])
    found = re.search(FIRST_LINE.get(path.suffix, r"(?!)"), text, re.M)
    return found.group(1).strip() if found else ""


def build() -> str:
    """The full MAP.md text."""
    files = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines()
    lines = ["# Repository map", "", "One line per tracked source file: its docstring, exported names or title. Regenerate with `python3 .github/scripts/repo_map.py`; CI fails when stale."]
    folder = None
    for name in sorted(files, key=lambda item: (str(Path(item).parent), item)):
        if SKIP.search(name) or not (ROOT / name).is_file():
            continue
        parent = str(Path(name).parent)
        if parent != folder:
            folder = parent
            lines += ["", f"## {folder}", ""]
        summary = purpose(ROOT / name)
        lines.append(f"- `{Path(name).name}`" + (f": {summary}" if summary else ""))
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    target = ROOT / "MAP.md"
    text = build()
    if "--check" in sys.argv:
        if not target.exists() or target.read_text(encoding="utf-8") != text:
            sys.exit("MAP.md is stale: run python3 .github/scripts/repo_map.py and commit the result")
    else:
        target.write_text(text, encoding="utf-8")
