# @roster-lock/config-editor-cli

A CLI (`rosterlock`) for building and editing roster-lock config drafts: engine
piece-type definitions, roster pieces, and per-type selection config.

## Using this with an AI assistant

This package ships a Skill describing how to use the CLI, at
[`skills/rosterlock-config-editor/SKILL.md`](skills/rosterlock-config-editor/SKILL.md).
It's plain markdown (following the open [Agent Skills](https://agentskills.io)
convention) - any assistant can be pointed at that file directly and follow it.

**Claude Code:** this package also includes a `.claude-plugin/plugin.json` marker,
so you can load it as a plugin without copying anything:

```bash
# From a local clone or checkout of this package:
claude --plugin-dir /path/to/config-editor-cli

# If installed as a dependency:
claude --plugin-dir ./node_modules/@roster-lock/config-editor-cli
```

Alternatively, copy just the skill into your own project so it's picked up
automatically, no `--plugin-dir` flag needed:

```bash
mkdir -p .claude/skills
cp -r node_modules/@roster-lock/config-editor-cli/skills/rosterlock-config-editor .claude/skills/rosterlock-config-editor
```

## Development

```bash
pnpm install
pnpm run dev -- <command>      # run from source via tsx
pnpm run build                 # compile to dist/
pnpm run test                  # vitest
pnpm run package                # bundle + package a standalone binary to bin/rosterlock-config-editor
```
