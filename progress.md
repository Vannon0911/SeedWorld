Original prompt: starte browser und lokalen server und dann einen live heaer test in der du im sschnelldurchlauf jede funktion testet an jeder position und kombinaation

- 2026-03-30: Startpunkt fuer Live-Browser-Test angelegt.
- TODO: Lokalen Server starten, Browser-Flow pruefen, schnelle Interaktionsmatrix dokumentieren.
- 2026-03-30: Live-Test blockiert durch falschen `.mjs`-MIME-Type im Static-Handler und Syntaxfehler in `app/src/plugins/radialBuildController.js`; beides fuer Browserlauf repariert.
- 2026-03-30: SoT- und Architekturtexte auf Canvas-first mit optionalem SVG-Overlay und DOM-nur-HUD/Panels ausgerichtet.
- 2026-03-30: Testline stabilisiert: `playwright` als Dev-Dependency ergaenzt, `check:required` auf `preflight:verify` umgestellt, Testline-Integritaet/Baseline aktualisiert.
- 2026-03-30: Volltest gruen (`npm run test:full`), inklusive `preflight:verify`, `npm test`, und `test:playwright:fulltiles`.
