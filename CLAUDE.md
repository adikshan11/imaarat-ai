@AGENTS.md

## Claude Code only

- Scoped rules load from `.claude/rules/`; task playbooks from `.claude/skills/`.
- Hooks in `.claude/settings.json` add the branch and version to each session and prompt, name the matching skills, and stop a push from `main` or `preprod`.
- MCP servers are in `.mcp.json`: Vercel (OAuth, run `/mcp` to sign in), Playwright, and Langfuse (needs `LANGFUSE_MCP_AUTHORIZATION` set to `Basic ` plus base64 of `public_key:secret_key`). Read tools are pre-approved; every write asks first.
- Run `/clear` between unrelated tasks. When compacting, keep the branch, version, files changed, commands run with their results, and open questions.
