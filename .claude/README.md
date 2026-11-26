<!-- sauron:start (managed by Sauron; edit outside this block) -->
# .claude/

> Managed by Sauron. Project-level Claude Code configuration.

## Folder map

- `settings.json`: shared project settings (permissions, hooks, env).
- `rules/`: Modular project instructions loaded alongside `CLAUDE.md`, optionally scoped to file paths.
- `skills/`: Reusable skills Claude loads on demand or via `/<skill-name>`. Skills replace the legacy `.claude/commands/` folder.
- `agents/`: Project subagents with their own system prompt, tools, and model.
- `workflows/`: Multi-step workflow definitions shared with the team.
- `output-styles/`: Custom output styles that change how Claude responds.
- `agent-memory/`: Persistent memory files written by subagents across sessions.
- `docs/`: Reference documents Claude can read on demand without loading them into every session.

Project instructions live in `CLAUDE.md` at the repository root. MCP servers go in `.mcp.json` at the root.

## Legacy

`.claude/commands/` is the older slash-command format. It still works, and Sauron installs its commands there; for new workflows prefer `.claude/skills/<name>/SKILL.md`.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/rules/

> Managed by Sauron.

### Purpose

Modular project instructions loaded alongside `CLAUDE.md`, optionally scoped to file paths.

### How to add a file

Create `.claude/rules/<topic>.md`, one topic per file.

### File format

Markdown. Optional YAML frontmatter `paths:` (list of globs) limits when the rule loads.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/skills/

> Managed by Sauron.

### Purpose

Reusable skills Claude loads on demand or via `/<skill-name>`. Skills replace the legacy `.claude/commands/` folder.

### How to add a file

Create `.claude/skills/<skill-name>/SKILL.md` plus any supporting files in that folder.

### File format

`SKILL.md` with YAML frontmatter `name` and `description`, followed by Markdown instructions.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/agents/

> Managed by Sauron.

### Purpose

Project subagents with their own system prompt, tools, and model.

### How to add a file

Create `.claude/agents/<agent-name>.md`.

### File format

Markdown with YAML frontmatter `name`, `description`, optional `tools` and `model`; body is the system prompt.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/workflows/

> Managed by Sauron.

### Purpose

Multi-step workflow definitions shared with the team.

### How to add a file

Create `.claude/workflows/<workflow-name>.md`.

### File format

Markdown describing the steps; see the official docs for supported frontmatter.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/output-styles/

> Managed by Sauron.

### Purpose

Custom output styles that change how Claude responds.

### How to add a file

Create `.claude/output-styles/<style-name>.md`.

### File format

Markdown with YAML frontmatter `name` and `description`; body is the style prompt.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/agent-memory/

> Managed by Sauron.

### Purpose

Persistent memory files written by subagents across sessions.

### How to add a file

Usually managed by Claude; add `.md` notes only when seeding memory deliberately.

### File format

Plain Markdown.

## Official docs

https://code.claude.com/docs/en/claude-directory

## .claude/docs/

> Managed by Sauron.

### Purpose

Reference documents Claude can read on demand without loading them into every session.

### How to add a file

Add Markdown files and reference them from `CLAUDE.md` or rules with `@.claude/docs/<file>.md`.

### File format

Plain Markdown.

## Official docs

https://code.claude.com/docs/en/claude-directory
<!-- sauron:end -->
