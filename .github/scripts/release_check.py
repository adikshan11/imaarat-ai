"""Release rules: work lands on preprod, only preprod is released to main, and a new version has a CHANGELOG entry."""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def backend_version(text: str) -> str:
    return re.search(r'__version__\s*=\s*"([^"]+)"', text).group(1)


def as_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def problems(files: dict[str, str], main_backend: str, head: str = "preprod", base: str = "") -> list[str]:
    found = []
    if base == "main" and head != "preprod":
        found.append(f"'{head}' cannot be released to main; only preprod is")
    version = backend_version(files["backend/app/__init__.py"])
    package = json.loads(files["frontend/package.json"])["version"]
    lock = json.loads(files["frontend/package-lock.json"])
    for name, value in (("frontend/package.json", package), ("package-lock.json", lock["version"]), ("package-lock.json packages['']", lock["packages"][""]["version"])):
        if value != version:
            found.append(f"{name} has {value}, backend/app/__init__.py has {version}")
    released = backend_version(main_backend)
    if as_tuple(version) < as_tuple(released):
        found.append(f"version {version} is below main's {released}")
    elif as_tuple(version) > as_tuple(released) and f"## [{version}] - " not in files["CHANGELOG.md"]:
        found.append(f"CHANGELOG.md has no '## [{version}] - <date>' entry")
    return found


def main() -> int:
    paths = ["backend/app/__init__.py", "frontend/package.json", "frontend/package-lock.json", "CHANGELOG.md"]
    files = {path: (ROOT / path).read_text(encoding="utf-8") for path in paths}
    main_backend = subprocess.run(["git", "show", "origin/main:backend/app/__init__.py"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    head = os.environ.get("GITHUB_HEAD_REF") or os.environ.get("GITHUB_REF_NAME", "preprod")
    found = problems(files, main_backend, head, os.environ.get("GITHUB_BASE_REF", ""))
    for problem in found:
        print(f"::error::{problem}")
    if not found:
        print(f"Release rules pass for {backend_version(files['backend/app/__init__.py'])}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
