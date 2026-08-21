# Agent workflow retros

Manual log of how multi-agent Cursor sessions ran (cost, launch order,
hand-off waste). Written only by the
[`workflow-retro`](../../.claude/skills/workflow-retro/SKILL.md) skill when a
human explicitly asks — never after `sdd-implement` or `Task` on its own.

| Artifact | Language | Who writes |
|---|---|---|
| Chat report | Russian | `workflow-retro` |
| [ledger.md](ledger.md) | English | `workflow-retro` (append-only) |

Not product/code lessons — those go to package `INSIGHTS.md` via
[`engineering-insights`](../../.claude/skills/engineering-insights/SKILL.md).

Transcript JSONL lives under `~/.cursor/projects/.../agent-transcripts/` and
must stay out of git.
