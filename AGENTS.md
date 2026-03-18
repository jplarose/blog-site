# AGENTS.md

This repository uses directory-scoped agent instructions.

## Mandatory instruction order

For any requested change, you must:

1. Read this file first.
2. Inspect the path of every file you will read or modify.
3. Read the closest applicable `AGENTS.md` for each affected directory before making changes.
4. Follow the most specific applicable `AGENTS.md` when instructions differ.

## Directory rules

- Changes in `./ui-admin/**` must follow `./ui-admin/AGENTS.md`.
- Changes in `./ui-site/**` must follow `./ui-site/AGENTS.md`.
- Changes spanning both projects must follow each local file within its own directory scope.
- Changes only at repository root follow this file alone.

## Precedence

Instruction precedence is:

1. Most specific nested `AGENTS.md`
2. Project-level `AGENTS.md`
3. Root `AGENTS.md`

## Implementation rule

Do not make edits until the applicable agent file(s) have been reviewed.
