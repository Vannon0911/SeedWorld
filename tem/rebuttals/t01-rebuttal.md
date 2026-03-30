# T01 Rebuttal

## Entscheidung
- **Widerlegt.**
- T01 war nicht vollstaendig genug, weil die Inventur nur Modulnamen sammelte, aber nicht alle relevanten Fallback-Branches und nicht den vollstaendigen Referenzgraphen geliefert hat.

## Ursachenforschung
- Die alte Inventur blieb zu grobgranular: `BaseUIController.js`, `MainMenuController.js` und `UIController.js` wurden als Block genannt, aber die entscheidenden Stellen liegen auf Methoden- und Branch-Ebene.
- Konkrete fehlende Stellen waren:
  - `app/src/ui/MainMenuController.js:282-303` mit direktem `kernelInterface(...)`-Fallback.
  - `app/src/ui/UIController.js:253-343` mit `#bindViewport()`- und `#ensureWorldState()`-Fallbacks.
  - `app/public/game.html:382-409` mit Worker- und No-Worker-Fallback auf `IsometricWorldGen`.
- Der Referenzgraph war nur behauptet, nicht aus dem Repo-Graphen hergeleitet. `app/src/sot/REPO_HYGIENE_MAP.json` zeigt aber klare Inbound-Zaehlungen und Abhaengigkeiten, die in der Inventur fehlen.

## Langfristige Loesung
- Inventuren muessen auf zwei Ebenen gefuehrt werden:
  1. Modul-Ebene fuer Ownership und Migration.
  2. Branch-/Methoden-Ebene fuer echte Delete/Migrate/Keep-Entscheidungen.
- Jede inventarisierte Stelle braucht mindestens:
  - konkrete Zeilen oder Methodennamen,
  - Caller- oder Consumer-Bezug,
  - Status `DELETE`, `MIGRATE` oder `KEEP`,
  - und einen Hinweis, warum der Status technisch gerechtfertigt ist.
- Wenn eine Datei nur ein Consumer-Hub ist, darf sie nicht pauschal als Legacy behandelt werden. Dann muss die Bewertung auf ihre Fallback-Branches oder Wrapper-Helfer reduziert werden.

## Implementierte Aenderungen
- `tem/t01-legacy-wrapper-inventur.md` wurde auf eine branch-genaue Inventur erweitert.
- Dort stehen jetzt:
  - die Archive- und Sync-Referenzen auf `legacy/UNVERFID/CANDIDATES.md`,
  - die Wrapper-Basis `BaseUIController.js` mit ihrem Inbound-Graphen,
  - die konkreten Fallback-Branches in `MainMenuController.js`, `UIController.js`, `preflight-mutation-guard.mjs` und `app/public/game.html`,
  - sowie eine explizite Bewertung `KEEP` / `MIGRATE` / `MIGRATE-REDUCE`.

## Fazit
- T01 ist in der vorliegenden Form **nicht bestaetigt**.
- Die technische Richtung stimmt, aber die Inventur war zu ungenau, um als Vollstaendigkeitssiegel zu gelten.
