---
name: shadcn-ui-npx-skills
description: Installs and relies on the official shadcn/ui Vercel Skills package for project-aware components, CLI, theming, and registries. Use when the project uses or should use shadcn/ui (components.json), when adding or composing UI from the shadcn registry, or when the user mentions npx skills add shadcn/ui, shadcn skills, or shadcn MCP.
---

# shadcn/ui via `npx skills add shadcn/ui`

## Quick start

From the **project root** (where `components.json` lives or will live after `init`):

```bash
npx skills add shadcn/ui
```

This installs the [official shadcn/ui skill](https://ui.shadcn.com/docs/skills) so the coding agent gets **project-specific** context (framework, aliases, installed components, icon and base libraries) instead of guessing.

**When to run or recommend it**

- The user is starting or extending shadcn/ui work and the packaged skill is not installed yet.
- Generated code might ignore local aliases, wrong component paths, or wrong base APIs (`radix` vs `base`).
- The user explicitly references `npx skills add`, Vercel Skills, or [skills.sh](https://skills.sh/).

Follow whatever install paths and agent hooks the CLI prints; do not assume a single global location.

## If the project is not initialized yet

Run shadcn setup first, then add the skill:

```bash
npx shadcn@latest init
npx skills add shadcn/ui
```

Use [shadcn CLI docs](https://ui.shadcn.com/docs/cli) for templates (`-t`), defaults (`-d`, `-y`), monorepos, and other `init` options.

## What the upstream skill is for (expectations)

Per official docs, the installed skill typically:

1. **Activates** when it finds `components.json`.
2. Uses **`shadcn info --json`** (or equivalent) to inject framework, Tailwind version, aliases, base library, icons, and installed components.
3. Steers composition toward current shadcn patterns (forms, toggles, semantic colors, base-correct APIs).
4. Supports discovery via **`shadcn` CLI** (`search`, `view`, `docs`) and optional [shadcn MCP](https://ui.shadcn.com/docs/mcp) for registries.

Prefer those mechanisms over inventing imports or file paths.

## Direct CLI (when not using the packaged skill)

Add components without the skill package:

```bash
npx shadcn@latest add button card dialog
```

Useful flags: `-y` (non-interactive), `-o` (overwrite), `--dry-run`, `-p <path>`. See [CLI reference](https://ui.shadcn.com/docs/cli).

## Additional resources

- [Skills (install & behavior)](https://ui.shadcn.com/docs/skills)
- [CLI commands](https://ui.shadcn.com/docs/cli)
- [MCP server](https://ui.shadcn.com/docs/mcp)
- [Theming](https://ui.shadcn.com/docs/theming)
- [Registry authoring](https://ui.shadcn.com/docs/registry)
- [skills.sh](https://skills.sh/) — Vercel Skills ecosystem
