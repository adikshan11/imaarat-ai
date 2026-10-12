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
WORK = "preprod"
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
    """Allow only a plain push of preprod, or the post-release reset."""
    command = event.get("tool_input", {}).get("command", "")
    if "git push" not in command:
        return None
    current = branch()
    if RESET not in command and (current != WORK or re.search(r"\s(-f\b|--force)|\bmain\b", command)):
        reason = f"Pushing from {current} like this is not allowed; work is committed on preprod, pushed without force, and reaches main only through the release pull request."
        return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": reason}}
    note = "Before pushing, the pr-ready checks must pass and a user-visible change needs the version bump and CHANGELOG entry."
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
