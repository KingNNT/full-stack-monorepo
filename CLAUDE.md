@AGENTS.md

## Claude Code

- `apps/*/CLAUDE.md` and `infra/CLAUDE.md` import their sibling `AGENTS.md`, so
  they load automatically when you work in those directories.
- `.claude/rules/api` and `.claude/rules/web` are symlinks to
  `apps/<app>/docs/agents/`; their `paths:` frontmatter loads each detail doc
  only when you touch matching files. Edit the docs in `apps/`, not via the
  symlink paths.
