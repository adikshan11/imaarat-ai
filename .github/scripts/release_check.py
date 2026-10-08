"""Pull request rules: feature branches into preprod, only preprod into main, one version above the base branch's, and a CHANGELOG entry for it."""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BRANCH = re.compile(r"^(feature|fix|ci|docs|chore)/[a-z0-9]+(_[a-z0-9]+)*$")


def backend_version(text: str) -> str:
    return re.search(r'__version__\s*=\s*"([^"]+)"', text).group(1)


def as_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def problems(branch: str, files: dict[str, str], base_backend: str, base: str = "preprod") -> list[str]:
    found = []
    if base == "main":
        if branch != "preprod":
            found.append(f"open '{branch}' against preprod; only preprod is released to main")
    elif not BRANCH.match(branch):
        found.append(f"branch '{branch}' should look like feature/short_name (feature, fix, ci, docs or chore, then snake_case)")
    version = backend_version(files["backend/app/__init__.py"])
    package = json.loads(files["frontend/package.json"])["version"]
    lock = json.loads(files["frontend/package-lock.json"])
    for name, value in (("frontend/package.json", package), ("package-lock.json", lock["version"]), ("package-lock.json packages['']", lock["packages"][""]["version"])):
        if value != version:
            found.append(f"{name} has {value}, backend/app/__init__.py has {version}")
    base_version = backend_version(base_backend)
    if as_tuple(version) <= as_tuple(base_version):
        found.append(f"version {version} must be above {base}'s {base_version}; bump it once per branch")
    if f"## [{version}] - " not in files["CHANGELOG.md"]:
        found.append(f"CHANGELOG.md has no '## [{version}] - <date>' entry")
    return found


def main() -> int:
    paths = ["backend/app/__init__.py", "frontend/package.json", "frontend/package-lock.json", "CHANGELOG.md"]
    files = {path: (ROOT / path).read_text(encoding="utf-8") for path in paths}
    base = os.environ.get("GITHUB_BASE_REF") or "preprod"
    base_backend = subprocess.run(["git", "show", f"origin/{base}:backend/app/__init__.py"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    found = problems(os.environ.get("GITHUB_HEAD_REF", ""), files, base_backend, base)
    for problem in found:
        print(f"::error::{problem}")
    if not found:
        print(f"Release rules pass for {backend_version(files['backend/app/__init__.py'])}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
