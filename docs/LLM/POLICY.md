# LLM Policy

## Default-Pflichten

1. Pflicht-Lesereihenfolge strikt einhalten.
2. Nur atomare Arbeitspakete umsetzen.
3. Vor Commit/Push: Guard + Sync + Pflicht-Preflight + volle Testline + Evidence-Verifikation.
4. Preflight nutzt einen Mutation-Guard: vor der Testline wird eine Laufzeitabweichung gesetzt und erst nach realer Codebehebung im naechsten Pflicht-Preflight aufgeloest.

## Commit-Blocker

- Fehlender ACK-Status (`runtime/.patch-manager/llm-read-state.json`)
- Hash-Mismatch zwischen ACK und Pflichtdokumenten
- Fehlende Runtime-Gegenpruefung
- Fehlende oder invalide Test-Evidence
- Testline-Integritaetsverletzung (Hash-Drift, Injection-Muster, Anti-Determinismus/BYPASS-Spuren)
- Fehlender/unsauberer Stand in `docs/LLM/AKTUELLE_RED_ACTIONS.md`
- Evidence-Lock-Verifikation fehlgeschlagen (manipulierte/fehlende Test-JSON-Outputs)

## Standardbefehle

```bash
npm run llm:entry
npm run llm:guard -- --action commit
npm run gate:testline:verify
npm run sot:verify
npm run evidence:lock:verify
npm run sync:docs
npm run preflight
npm test
```
