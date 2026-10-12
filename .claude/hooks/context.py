"""Claude Code hook that adds branch context, names matching skills and guards pushes."""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SKILLS = {
    "release": r"\b(release|ship|merge|deploy|promote)\b",
    "pr-ready": r"\b(pr|pull request|commit|push)\b",
    "live-check": r"\b(live|deployed|production|preprod|status|trace|langfuse)\b",
    "add-ui-text": r"\b(translat\w*|locale\w*|i18n|label|wording)\b",
}
PROTECTED = {"main", "preprod"}
RESET = "origin/main:refs/heads/preprod"


def branch() -> str:
    """Return the current git branch."""
    result = subprocess.run(["git", "branch", "--show-current"], cwd=ROOT, capture_output=True, text=True, check=False)
    return result.stdout.strip() or "detached"


def version() -> str:
    """Return the backend version."""
    match = re.search(r'__version__ = "([^"]+)"', (ROOT / "backend" / "app" / "__init__.py").read_text(encoding="utf-8"))
    return match.group(1) if match else "unknown"


def context(event: dict) -> dict:
    """Build extra context for a session start or a prompt."""
    name = event.get("hook_event_name", "")
    text = f"Branch {branch()}, version {version()}. Follow AGENTS.md."
    matched = [skill for skill, pattern in SKILLS.items() if re.search(pattern, event.get("prompt", ""), re.IGNORECASE)]
    if matched:
        text += " Matching skills: " + ", ".join(matched) + "."
    return {"hookSpecificOutput": {"hookEventName": name, "additionalContext": text}}


def push_guard(event: dict) -> dict | None:
    """Deny a push from main or preprod unless it is the post-release reset."""
    command = event.get("tool_input", {}).get("command", "")
    if "git push" not in command:
        return None
    current = branch()
    if current in PROTECTED and RESET not in command:
        reason = f"Pushing from {current} is not allowed; work on a feature branch and open a pull request."
        return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}
    note = "Before pushing, the pr-ready checks and, for feature/ and fix/ branches, the version bump and CHANGELOG entry must be done."
    return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": note}}


def main() -> int:
    """Read the hook event from stdin and print the response."""
    event = json.load(sys.stdin)
    response = push_guard(event) if event.get("hook_event_name") == "PreToolUse" else context(event)
    if response:
        print(json.dumps(response))
    return 0


if __name__ == "__main__":
    sys.exit(main())
