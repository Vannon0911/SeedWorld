# T03 Rebuttal

## Urteil
T03 ist in der aktuellen Repo-Realitaet **nicht praxisfest**. Die Idee ist brauchbar, aber sie lebt derzeit nur als Doku-Versprechen. Ein Gate, das nur im Text existiert, ist kein Gate, sondern Tapetenmuster mit Anspruch.

## Beleg
- In `package.json` gibt es `preflight:guard`, `preflight:verify`, `check:required` und `release:guard`, aber kein `check:wrapper-guardrails`.
- `.github/workflows/required-checks.yml` fuehrt nur `npm run preflight` aus; ein Wrapper-Check fehlt komplett.
- `.github/rulesets/main-protection.json` verlangt nur den Status `preflight-and-governance`, nicht einen Wrapper-Guardrail-Check.
- Die Suche im Repo findet `wrapperId`, `ticketRef`, `canonicalTarget`, `expiresAt` und `legacy.wrapper.*` nur in der T03-Doku, nicht in einer zentralen Registry oder einem Validator.
- Die vorhandene Guard-Infrastruktur adressiert andere Probleme: `dev/tools/runtime/preflight-mutation-guard.mjs` schutzt Runtime-/Lock-Pfade, `dev/tools/patch/lib/lock.mjs` schutzt Session-Locks. Wrapper-TTLs sind dort nicht angeschlossen.

## Ursachenanalyse
1. Es fehlt eine maschinenlesbare Wrapper-Registry als Source of Truth.
2. Es fehlt ein CI-Job, der Wrapper-Metadaten wirklich validiert.
3. Der Owner-/Eskalationspfad ist nicht deterministisch aufloesbar.
4. `lastObservedAt` ist ohne Runtime-Hook oder Audit-Log nur Wunschdenken.
5. Die `today`-Logik ist nicht auf eine feste Zeitzone normalisiert, damit laufen Ablaufdaten an Grenztagen wie ein kaputter Kompass.

## Langfristige Loesung
1. Eine zentrale Wrapper-Registry einführen, die alle Pflichtfelder technisch erzwingt.
2. `npm run check:wrapper-guardrails` als eigenen Check bauen und in `check:required` sowie in den Required-Checks-Workflow einhaengen.
3. Owner-Aufloesung, UTC-Tagesgrenze und Eskalationspfad explizit definieren, statt sie aus einer Hoffnungskiste zu holen.
4. `lastObservedAt` nur aus echten Laufzeitereignissen oder Audit-Daten schreiben, nicht manuell pflegen.

## Umsetzung in den Ownership-Dateien
- Diese Datei markiert T03 als **offen / nicht bestaetigt**.
- `tem/slices/t03-guardrail-konzept.md` enthaelt jetzt die fehlenden Praxisvoraussetzungen, damit die Spezifikation nicht weiter so tut, als waere sie schon durchgesetzt.
