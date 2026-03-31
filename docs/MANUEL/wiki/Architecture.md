# Architecture

Tags: `architecture` `kernel` `content` `reproduction`

## Kerngrenze

- `app/src/kernel/`: deterministische Kernel-Ausfuehrung
- `app/src/game/`: autoritative Spielinhalte und Regelinterpretation
- `dev/scripts/` + `dev/tests/modules/` + `dev/tools/runtime/verify-testline-integrity.mjs`: Reproduktionsbeweis
- `app/src/ui/` und `app/public/`: nur noch schlanker Browser-Adapter, nicht fuehrende Wahrheit

## Ausfuehrungsfluss

1. autoritativer Inhalt oder Testinput liefert Action + State
2. `GameLogicController` berechnet erlaubte Aenderungen
3. Kernelpfad fuehrt deterministisch aus
4. Doppel-Lauf-Evidence belegt Reproduktion
5. Testline-Schlusstest bestaetigt die Beweiskette

## Regel

- kein zweiter Kernelpfad
- keine zweite Content-Wahrheit
- keine Pflicht-Gates ausserhalb von Reproduktion und Evidence

## Referenzen

- [../../V2/SYSTEM_PLAN.md](../../V2/SYSTEM_PLAN.md)
- [../../V2/RULES.md](../../V2/RULES.md)
- [../../SOT/ORIENTATION.md](../../SOT/ORIENTATION.md)
- [../../SOT/REPO_HYGIENE_MAP.md](../../SOT/REPO_HYGIENE_MAP.md)
