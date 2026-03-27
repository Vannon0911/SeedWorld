# AGENTS

Dieses Repository nutzt einen einheitlichen Patch-Flow mit terminal-exklusiver Write-Authority.

## Harte Regeln

1. Verwende fuer Writes nur:
   - `npm run patch:apply -- --input <zip-oder-json>`
2. Fuehre keine Browser-Endpunkte aus, die direkt Patches/Gates schreiben.
3. `llm:entry`, `llm:ack`, `llm:check` nur innerhalb der terminal-exklusiven Patch-Session.
4. Es darf nur eine aktive Write-Session geben (`.patch-manager/terminal-session.lock`).
5. Bei aktivem Lock niemals parallel schreiben; stale takeover nur ueber deadman/TTL.
6. Bei Unsicherheit fail-closed: stoppen, nicht schreiben.

## Browser/UI Scope

Erlaubt:
- Session starten
- Session beobachten (SSE/Status/Logs/Result)
- Session stoppen

Nicht erlaubt:
- direkte Gate-Freigaben
- direkte Patch-Execute-Endpunkte
- Umgehung von Lock/Deadman

## Erwartetes Ergebnis je Lauf

- Strukturierte JSONL-Logs
- Menschenlesbare Summary
- Klarer Endstatus: `succeeded`, `failed_rolled_back`, `failed_partial`
