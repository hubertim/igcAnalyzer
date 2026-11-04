# Issue Tracker for igcAnalyzer

This repo uses **GitHub Issues** as its issue tracker. All tickets, feature requests, and bug reports live in the GitHub Issues queue of `hubertim/igcAnalyzer`.

## How to work with issues

- Use [`flatpak-spawn --host gh`](https://cli.github.com/) to interact with issues and PRs (VSCodium läuft als Flatpak).
- PRs are **not** used as a request surface by default. If you want to surface PR requests in the issue queue, see the advanced section below.

### Basic workflow

1. Create an issue: `flatpak-spawn --host gh issue create --title "..." --body "..."`
2. Comment on an issue: `flatpak-spawn --host gh issue comment <number> --body "..."`
3. Close an issue: `flatpak-spawn --host gh issue close <number>`
4. Label issues: `flatpak-spawn --host gh issue edit <number> --add-label needs-triage`

### Triage workflow

The [`triage`](../skills/triage/SKILL.md) skill assumes these default labels are present in your repo:

- `needs-triage`
- `needs-info`
- `ready-for-agent`
- `ready-for-human`
- `wontfix`

If they're missing, run:

```bash
flatpak-spawn --host gh label create needs-triage --color yellow --description "Initial assignment needed"
flatpak-spawn --host gh label create needs-info --color blue --description "Waiting for clarifications"
flatpak-spawn --host gh label create ready-for-agent --color green --description "Ready for agent work"
flatpak-spawn --host gh label create ready-for-human --color purple --description "Needs human review/approval"
flatpak-spawn --host gh label create wontfix --color gray --description "Won't be fixed"
```

## Advanced: PRs as a request surface (optional)

This repo does **not** use PRs as a request surface by default. If you want to raise PR requests in the issue queue instead of creating direct branches, set this flag in [`AGENTS.md`](../AGENTS.md):

```markdown
### Issue tracker
GitHub Issues for `hubertim/igcAnalyzer` with PRs as a request surface (**on**). See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).
```

Then edit this file and change:

```text
"prAsRequestSurface": true
```

See the `to-spec` skill for details on how it interacts with issue trackers.
