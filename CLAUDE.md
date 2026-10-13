@AGENTS.md

## Claude Code

- `apps/*/CLAUDE.md` and `infra/CLAUDE.md` import their sibling `AGENTS.md`, so
  they load automatically when you work in those directories.
- `.claude/rules/api` and `.claude/rules/web` are symlinks to
  `apps/<app>/docs/agents/`; their `paths:` frontmatter loads each detail doc
  only when you touch matching files. Edit the docs in `apps/`, not via the
  symlink paths.
- `.claude/skills/git-flow` is a symlink to `.agents/skills/git-flow`, shared
  with other harnesses; edit the skill there.
- `.claude/skills/env-push` and `.claude/skills/env-check` are symlinks to
  `.agents/skills/`, shared with other harnesses; edit the skills there.
