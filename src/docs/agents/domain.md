# Domain Docs for igcAnalyzer

This repo uses a **single-context** domain doc layout:

- `GLOSSARY.md` at the repo root: the main vocabulary and concepts
- `docs/adr/`: Architecture Decision Records (ADRs)
- `CONTEXT.md` or `CONTEXT-MAP.md` at the repo root: optional legacy context files

## Where to read domain docs

1. Start with [`GLOSSARY.md`](../GLOSSARY.md) for key terms, abstractions, and vocabulary.
2. Look at `docs/adr/` for architectural decisions that affect how the codebase is structured or extended.
3. Check `CONTEXT.md` or `CONTEXT-MAP.md` if they exist; these may contain legacy context that should be migrated to `GLOSSARY.md`.

## Consumer rules

- **Read `GLOSSARY.md` first**: It defines the domain vocabulary and key abstractions. Don't assume you know terms without looking them up there.
- **ADRs are immutable**: Once an ADR is written, don't edit it unless you're migrating legacy docs. New decisions should be new files (`adr-001.md`, `adr-002.md`, etc.).
- **Legacy context**: If `CONTEXT.md` or `CONTEXT-MAP.md` exists at the root, consider migrating them to `GLOSSARY.md` and updating references accordingly.
- **No per-context glossaries**: This repo does not use a multi-context layout (`GLOSSARY-MAP.md`). All domain docs live at the root level.
