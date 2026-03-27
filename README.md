# SeedWorld

SeedWorld nutzt einen terminal-exklusiven, einheitlichen Patch-Flow.

## Schnellstart

```bash
npm install
npm start
```

Spiel: `http://localhost:8080`

## Patch-Flow (kanonisch)

Einziger Write-Einstieg:

```bash
npm run patch:apply -- --input <pfad-zur-zip-oder-json>
```

Optional:

```bash
npm run patch:apply -- --input <pfad> --actor <name>
```

Der Lauf folgt strikt den Phasen:

`intake -> unpack -> manifest-validate -> normalize -> risk-classify -> acquire-lock -> llm-gates -> backup -> apply -> verify -> test -> finalize -> release-lock`

## Browser Control Plane

```bash
npm run patch:server
```

UI: `http://localhost:3000`
Popup: `http://localhost:3000/popup`

Die Browser-UI darf nur:
- Session starten
- Session beobachten (Status/SSE/Logs/Result)
- Session stoppen

Die Browser-UI darf nicht:
- `llm:*` Gates direkt ausfuehren
- direkte Execute/Freigabe-Pfade triggern

## Session-Artefakte

- Lock: `.patch-manager/terminal-session.lock`
- Intake: `.patch-manager/intake/<session-id>/`
- Status: `.patch-manager/sessions/<session-id>.status.json`
- Logs: `.patch-manager/logs/<session-id>.jsonl`
- Summary: `.patch-manager/logs/<session-id>.summary.txt`

## Tests

```bash
npm test
```
