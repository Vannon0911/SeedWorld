import { LogBus } from './LogBus.js';

/**
 * BrowserPatchRunner
 * Nimmt ein vom Server validiertes Patch-Manifest entgegen
 * und registriert die Hooks über den Kernel.
 */
export class BrowserPatchRunner {
  constructor(kernel) {
    this.kernel = kernel;
    this.applied = [];
  }

  apply(patches) {
    const errors = [];
    const applied = [];

    if (!Array.isArray(patches) || patches.length === 0) {
      LogBus.emit({ domain: 'run', message: 'Keine Patches zum Anwenden.' });
      return { ok: false, applied, errors: ['Leeres Patches-Array.'] };
    }

    LogBus.emit({ domain: 'run', message: `Starte Anwendung: ${patches.length} Patch(es).` });

    for (const patch of patches) {
      const patchId = patch?.id || '(unbekannt)';
      try {
        const result = this.kernel.execute({
          domain: 'patch',
          action: { type: 'applyBrowserPatch', patch }
        });
        
        if (result && result.success === false) {
          throw new Error(result.error || 'Patch konnte nicht angewendet werden.');
        }

        applied.push(patchId);
        LogBus.emit({ domain: 'ok', message: `${patchId} registriert.` });
      } catch (err) {
        errors.push(`${patchId}: ${err.message}`);
        LogBus.emit({ domain: 'err', message: `${patchId} — ${err.message}` });
      }
    }

    this.applied = applied;
    const ok = errors.length === 0;
    LogBus.emit({ domain: 'run', message: ok ? 'Fertig ohne Fehler.' : `Fertig mit ${errors.length} Fehler(n).` });

    return { ok, applied, errors };
  }

  rollback() {
    LogBus.emit({ domain: 'rollback', message: 'Patches werden entfernt...' });
    for (const patchId of this.applied) {
      try {
        this.kernel.execute({
          domain: 'kernel',
          action: { type: 'unregisterPatch', patchId }
        });
        LogBus.emit({ domain: 'rollback', message: `${patchId} entfernt.` });
      } catch (err) {
        LogBus.emit({ domain: 'err', message: `Rollback ${patchId}: ${err.message}` });
      }
    }
    this.applied = [];
  }
}
