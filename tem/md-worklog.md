# MD Worklog

Stand: nach dieser Vervollstaendigung. Dieser Worklog inventarisiert die vorhandenen MD-Artefakte unter `tem/`, markiert die Luecken und trennt klar zwischen CHECK-synchronisierten, offenen und neuen Meta-Dokumenten.

## Kurzstatus
- CHECK-synchronisierte Planartefakte: 4
- Offene Slice-/Evidenz-Artefakte: 4
- Quellen-/Report-Dokumente: 4
- Neue Meta-Dokumente aus diesem Durchlauf: 3
- Offene Task-Stubs insgesamt: 28

## Inventar

### Planquellen und Reports
| Datei | Rolle | Status | Notiz |
|---|---|---|---|
| `tem/beide-plaene.md` | Hauptplan fuer Canvas-First und Legacy/Wrapper | `ACTIVE` | Enthaelt CF-001 bis CF-012 sowie T01 bis T13; 5 Aufgaben sind per `[CHECK]` markiert. |
| `tem/langfristiger-bug-plan.md` | Langfristiger Bug- und Risiko-Plan | `ACTIVE` | Enthaelt die offenen Backlog-Punkte P0 bis P2 mit Verifikationsstrategie. |
| `tem/reported-bugs.md` | Ausgangslage / gemeldete Bugs | `ACTIVE` | Liefert den Bug-Kontext fuer die folgenden Migrations- und Evidence-Dokumente. |
| `tem/test-evidence-report.md` | Test-/Evidence-Snapshot | `GREEN_WITH_KNOWN_GAP` | `npm test` und `npm run evidence:verify` sind gruen; `npm run evidence:bundle` ist wegen fehlendem `jszip` blockiert. |

### CHECK- und Synchronisationsartefakte
| Datei | Rolle | Status | Notiz |
|---|---|---|---|
| `tem/cf-001-architektur-notiz.md` | Architektur-Notiz fuer RenderManager-SoT | `CHECK_COMPLETE` | Fixiert viewport, tileSize, gridBounds, worldToScreen und screenToTile als zentrale Geometriequelle. |
| `tem/t01-legacy-wrapper-inventur.md` | Inventur Legacy / Wrapper / Fallback | `CHECK_COMPLETE` | Enthaelt erste Klassifikation fuer Legacy-Archiv, UI-Wrapper und Browser-Fallbacks. |
| `tem/slices/t02-kanonische-api-matrix.md` | Kanonische API-Matrix | `CHECK_COMPLETE` | Konsolidiert die Ziel-APIs fuer Viewport, Grid, Koordinaten und Hit-Testing. |
| `tem/slices/t03-guardrail-konzept.md` | Guardrail-Konzept fuer Wrapper | `CHECK_COMPLETE` | Definiert TTL, Flags, CI-Gates und den Eskalationspfad fuer Wrapper. |

### Offene Slice- und Evidenz-Artefakte
| Datei | Rolle | Status | Notiz |
|---|---|---|---|
| `tem/slices/cf-003-canvas-render-loop.md` | Canvas-Render-Loop | `OPEN` | Frame-Takt, Clear/Redraw und Layer-Reihenfolge sind dokumentiert, aber noch nicht abgeschlossen. |
| `tem/slices/cf-004-tile-dom-to-canvas.md` | Tile-Basisdarstellung DOM -> Canvas | `OPEN` | Basis-Tiles sollen auf Canvas landen; Hover, Selection und Effekte bleiben bewusst draussen. |
| `tem/slices/evidence-remediation-jszip.md` | Evidence-Bundle-Blocker | `BLOCKED` | Der fehlende `jszip`-Eintrag ist als enger Tooling-Fehler beschrieben. |
| `tem/slices/integration-summary.md` | Integrations-Status | `PARTIAL` | Bisher nur ein kurzer Ueberblick; die belastbare Vollzuordnung liegt jetzt in dieser Worklog-Datei und in `tem/traceability-map.md`. |

### Neue Meta-Dokumente aus diesem Durchlauf
| Datei | Rolle | Status | Notiz |
|---|---|---|---|
| `tem/md-worklog.md` | MD-Inventar und Gap-Report | `CREATED` | Dieser Worklog selbst. |
| `tem/slices/remaining-task-stubs.md` | Stub-Sammlung fuer alle offenen Tasks | `CREATED` | Enthaelt die offenen Tasks aus `tem/beide-plaene.md` und `tem/langfristiger-bug-plan.md`. |
| `tem/traceability-map.md` | Task -> Datei -> Test/Check | `CREATED` | Verlinkt jeden Task auf das fuehrende Artefakt und die zugehoerige Verifikation. |

## Fehlende Luecken
| Gap | Status | Kommentar |
|---|---|---|
| Eigene Slice-Datei fuer CF-002 | `COVERED_IMPLICITLY` | Kein separates MD vorhanden; die Architektur-Notiz unter `tem/cf-001-architektur-notiz.md` traegt den SoT-Kern mit. |
| Eigenstaendige Slice-Dateien fuer CF-005 bis CF-012 | `OPEN` | Diese Aufgaben sind jetzt als Stubs dokumentiert, haben aber noch keine dedizierten Implementierungs-MDs. |
| Eigenstaendige Slice-Dateien fuer T04 bis T13 | `OPEN` | Die Legacy-/Wrapper-Tasks sind jetzt stubbed, aber nicht einzeln umgesetzt. |
| Eigenstaendige Slice-Dateien fuer P0 bis P2 aus dem langfristigen Bug-Plan | `OPEN` | Die Risiken sind inventarisiert; Implementierung und Verifikation folgen. |
| Vollstaendiger Integrations-Index | `PARTIAL` | Der komprimierte `integration-summary.md` bleibt als Kurzuebersicht bestehen; der vollstaendige Index liegt jetzt in `tem/traceability-map.md`. |
| Evidence-Bundle-Tooling | `BLOCKED` | `npm run evidence:bundle` ist weiterhin durch die fehlende `jszip`-Abhaengigkeit blockiert. |

## Statusbild
- Die 5 CHECK-markierten Aufgaben sind dokumentiert: CF-001, CF-002, T01, T02 und T03.
- Die 28 offenen Tasks sind in `tem/slices/remaining-task-stubs.md` gesammelt.
- Die neue Traceability map deckt alle Tasks aus beiden Planquellen plus den langfristigen Bug-Plan ab.
- Es wurden keine Dateien ausserhalb von `tem/` angefasst.
