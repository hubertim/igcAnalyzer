# Triage Label Vocabulary for igcAnalyzer

This repo uses **default** triage labels. Each label string equals its name:

| Label | Description |
|-------|-------------|
| `needs-triage` | Initial assignment needed; not yet owned |
| `needs-info` | Waiting for clarifications or more context |
| `ready-for-agent` | Ready for agent work (implementation) |
| `ready-for-human` | Needs human review, approval, or sign-off |
| `wontfix` | Won't be fixed; marked as such by maintainers |

## How to use these labels

- **Apply to issues**: `flatpak-spawn --host gh issue edit <number> --add-label needs-triage`
- **Remove from issues**: `flatpak-spawn --host gh issue edit <number> --remove-label needs-triage`
- **Bulk label via CLI**: Use your preferred tool or script.

## Overriding labels (optional)

If you want to use custom label names instead (e.g., `bug:triage` for `needs-triage`), update the values in [`AGENTS.md`](../AGENTS.md) and re-run the skill's configuration step. See the `triage` skill documentation for details.
