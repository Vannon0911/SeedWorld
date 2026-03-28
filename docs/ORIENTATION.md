# SeedWorld Orientation (Baseline: 2026-03-28)

## 1) System Map

SeedWorld trennt Verantwortungen strikt:

- `src/ui/`: Rendering, Events, Animation, keine direkten State-Writes.
- `src/game/`: Spielregeln, berechnet nur erlaubte Patch-Vorschlaege.
- `src/kernel/`: einzige Write-Instanz, validiert und appliziert Patches fail-closed.
- `tools/runtime/`: Preflight-, Lock- und Sync-Gates fuer Reproduzierbarkeit.
- `tests/`: ein Einstiegspunkt `tests/MainTest.mjs`, Module unter `tests/modules/`.

Kernfluss:

1. UI Event
2. GameLogic erzeugt Patch-Kandidaten
3. Kernel prueft Schema/Domain/Determinismus/Governance
4. Store wird nur ueber erlaubte Patches veraendert

## 2) Day-1 Command Order

Empfohlener lokaler Start:

```bash
npm install
npm run sync:docs
npm run preflight
npm test
npm start
```

Patch-Manager (separat):

```bash
npm run patch:server
```

Governance-sensitive Aenderungen (LLM-Kette):

```bash
npm run llm:update-lock
npm run llm:classify -- --paths <pfade>
npm run llm:entry -- --paths <pfade>
npm run llm:ack -- --paths <pfade>
npm run llm:check -- --paths <pfade>
```

## 3) Current Baseline Signal

- `npm run preflight`: PASS (`[PREFLIGHT] OK`)
- `npm test`: PASS (`16/16 Module PASS`)
- Zuletzt benoetigte Reparatur: `FUNCTION_SOT` Sync via `npm run sync:docs`

## 4) Priorisierte Next Tasks

1. **Stability Guardrail**
   - `sync:docs -> preflight -> test` als festen lokalen Vor-PR-Check etablieren.
2. **Patch Workflow Hardening**
   - `tools/patch/*` und `patches/` in den regulierten Test-Flow integrieren.
3. **Feature Work (UI/Game)**
   - Neue Features nur ueber Kernel-Interface und bestehende Patch-Gates einhaengen.
4. **Developer Onboarding**
   - Diese Orientierung plus README/WORKFLOW als erste Pflichtlektuere verlinken.
