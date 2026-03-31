# System Plan

Dies ist der laufende Systemplan fuer Documentation 2.0. Er deckt die aktiven Bereiche des Repos ab und verbindet sie mit offenen atomaren Tasks.

## Bereiche

### kernel-core

- Truth: Deterministic kernel execution and state transitions.
- Roots: `app/src/kernel`
- Open Tasks: keine

### gameplay-content

- Truth: Authoritative content, rules and world interpretation.
- Roots: `app/src/game`
- Open Tasks: keine

### reproduction-evidence

- Truth: Double-run proof, evidence validation and final testline consistency.
- Roots: `dev/scripts`, `dev/tests/modules`, `dev/tools/runtime/verify-testline-integrity.mjs`
- Open Tasks: `CF-011`, `CF-012`

### browser-adapter

- Truth: Remaining browser path as adapter, not as competing domain truth.
- Roots: `app/src/main.js`, `app/src/ui`, `app/public`
- Open Tasks: `CF-003`, `CF-004`, `CF-005`, `CF-006`, `CF-007`, `CF-008`, `CF-009`, `CF-010`, `CF-012`

### documentation-v2

- Truth: Human-readable truth, atomic planning and archive automation.
- Roots: `docs/V2`, `tem/tasks`, `app/src/sot/docs-v2.json`
- Open Tasks: keine

### legacy-cleanup

- Truth: Tracked migration residue that must not create unregistered plan drift.
- Roots: `tem`, `docs/IN PLANUNG`, `legacy/UNVERFID`
- Open Tasks: keine

