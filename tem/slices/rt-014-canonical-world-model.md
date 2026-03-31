# RT-014 Canonical World Model

## Scope
Kanonisches Weltmodell fuer Volume/Block/Chunk einfuehren, ohne `world.tiles` sofort zu entfernen.

## Betroffene Dateien
- `app/src/game/worldGen.js`
- `app/src/game/worldState.js`
- `app/src/ui/UIController.js`

## Abnahmekriterien
- `world.volume`, `world.blocks` und `world.chunks` sind vorhanden und als kanonische Wahrheit dokumentiert.
- `world.tiles` ist explizit als Legacy-/Debug-Projektion markiert.
- Kein Rueckschreiben von `world.tiles` in den kanonischen Pfad.

## Testschritte
1. `npm test`
2. Welt-State-Snapshot fuer kanonische Felder
3. Determinismus-Pruefung fuer `worldHash`-Vorstufe
