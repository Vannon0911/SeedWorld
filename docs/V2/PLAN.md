# Planning Path

Offene Planung liegt nur noch als atomare Einzel-Tasks vor. Ein Task bleibt offen, bis sein deklarierter Scope im aktuellen Aenderungssatz vollstaendig getroffen wurde. Dann verschiebt der Scanner ihn ins Archiv.

## Open Tasks

### CF-003 Einen einzigen aktiven Frame-Scheduler festziehen

- JSON: `tem/tasks/open/CF-003.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/UIController.js`, `app/src/ui/RenderManager.js`, `app/src/main.js`, `app/public/game.html`
- Description: Doppelte Render-Loops entfernen und nur einen aktiven Scheduler fuer die Browseransicht lassen.

### CF-004 Tile-Basisdarstellung auf Canvas ziehen

- JSON: `tem/tasks/open/CF-004.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/TileGridRenderer.js`, `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`, `app/public/game.html`, `app/src/ui/tileGrid.css`
- Description: Canvas als primaren Tile-Pfad setzen und DOM nur noch als Restadapter behandeln.

### CF-005 Hover, Selection und Effekte als Canvas-Layer ziehen

- JSON: `tem/tasks/open/CF-005.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/IconAnimations.js`, `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`
- Description: Overlay-, Hover- und Effektlogik in denselben Canvas-Koordinatenraum ziehen.

### CF-006 World-Hintergrund in denselben Koordinatenraum ziehen

- JSON: `tem/tasks/open/CF-006.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`, `app/public/game.html`
- Description: World- oder Hintergrundlayer mit derselben Geometrie wie die Tile-Darstellung verbinden.

### CF-007 SVG-Overlay auf Restlinien reduzieren

- JSON: `tem/tasks/open/CF-007.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`, `app/public/game.html`
- Description: SVG nur noch fuer unvermeidliche Linien- oder Pulseffekte behalten und Layer-Reihenfolge absichern.

### CF-008 Pointer-Hit-Testing auf screenToTile umstellen

- JSON: `tem/tasks/open/CF-008.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/RenderManager.js`, `app/src/ui/UIController.js`
- Description: Interaktion nicht mehr ueber DOM-Rechtecke, sondern ueber Geometrie aus dem Renderpfad berechnen.

### CF-009 DOM-Grid abbauen

- JSON: `tem/tasks/open/CF-009.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/TileGridRenderer.js`, `app/public/game.html`, `app/src/ui/tileGrid.css`
- Description: DOM soll nur noch HUD oder Panel tragen, nicht mehr die Tile-Flaeche selbst.

### CF-010 Debug-State um Canvas-Sicht erweitern

- JSON: `tem/tasks/open/CF-010.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/UIController.js`, `app/src/ui/RenderManager.js`
- Description: Debug- oder Textausgaben sollen die echte Canvas-Sicht und Geometrie mit abbilden.

### CF-011 Canvas-Deckungsgleichheit per Tests absichern

- JSON: `tem/tasks/open/CF-011.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `dev/scripts/test-runner.mjs`, `dev/scripts/verify-evidence.mjs`, `dev/tools/runtime/verify-testline-integrity.mjs`
- Description: Resize, Zoom und Overlay-Verhalten in der Testlinie maschinenlesbar absichern.

### CF-012 Canvas-Hit-Testing und HUD-Smokes stabilisieren

- JSON: `tem/tasks/open/CF-012.json`
- Track: `canvas-migration`
- Match: `all_scope_paths_touched`
- Source: `docs/V2/SYSTEM_PLAN.md`
- Scope: `app/src/ui/UIController.js`, `app/src/ui/RenderManager.js`, `dev/scripts/test-runner.mjs`
- Description: Interaktion und HUD sollen nach der Canvas-Migration ohne Sonderpfade testbar bleiben.

