import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location("release_check", Path(__file__).resolve().parents[2] / ".github" / "scripts" / "release_check.py")
release_check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_check)


def files(version, package=None, changelog=None):
    lock = {"version": package or version, "packages": {"": {"version": package or version}}}
    return {
        "backend/app/__init__.py": f'__version__ = "{version}"\n',
        "frontend/package.json": json.dumps({"version": package or version}),
        "frontend/package-lock.json": json.dumps(lock),
        "CHANGELOG.md": changelog if changelog is not None else f"## [{version}] - 2026-10-07\n",
    }


def test_a_bumped_documented_release_passes():
    assert release_check.problems(files("2.30.0"), '__version__ = "2.29.0"') == []


def test_each_rule_reports_its_own_problem():
    found = release_check.problems(files("2.29.0", package="2.28.0"), '__version__ = "2.30.0"')
    assert len(found) == 4
    assert any("below main" in item for item in found)
    assert release_check.problems(files("2.30.0", changelog=""), '__version__ = "2.29.0"') == ["CHANGELOG.md has no '## [2.30.0] - <date>' entry"]


def test_only_preprod_releases_to_main():
    assert release_check.problems(files("2.30.0"), '__version__ = "2.29.0"', "preprod", "main") == []
    assert any("only preprod" in item for item in release_check.problems(files("2.30.0"), '__version__ = "2.29.0"', "feature/react_landing", "main"))


def test_unreleased_ci_changes_need_no_version():
    assert release_check.problems(files("2.29.0", changelog=""), '__version__ = "2.29.0"') == []
