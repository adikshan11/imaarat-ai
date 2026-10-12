# Copilot instructions

Shared rules are in `AGENTS.md` at the repository root, which Copilot loads automatically. Scoped rules in `.claude/rules/` and skills in `.claude/skills/` load in VS Code too. Copilot-only notes:

- MCP servers are shared in `.mcp.json`. VS Code users can copy them into their own `.vscode/mcp.json`, which is not committed. Vercel signs in with OAuth; Langfuse asks once for its `Basic` authorization value and stores it securely.
- Use the GitHub CLI for pull requests and workflow runs, as described in `.claude/skills/release/SKILL.md`.
- Start a new chat for each task.
