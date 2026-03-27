/**
 * LogBus — Einziger Log-Kanal für alle Quellen.
 *
 * Quellen:
 *   - SSE (Server-Sessions via EventSource)
 *   - inline (Browser-seitige BrowserPatchRunner-Läufe)
 *
 * Format: [TICK] [DOMAIN] message   (TICK = dezimaler Zähler ab 0)
 *
 * API:
 *   LogBus.emit({ domain, message, tick? })
 *   LogBus.subscribe(callback)   → gibt unsubscribe-Funktion zurück
 *   LogBus.connectSSE(sessionId) → öffnet EventSource, gibt close-Funktion zurück
 */

let _tick = 0;
const _bus = new EventTarget();

function pad(n) { return String(n).padStart(4, '0'); }

export const LogBus = Object.freeze({
  /**
   * Sendet einen Log-Eintrag an alle Abonnenten.
   * @param {{ domain: string, message: string, tick?: number }} entry
   */
  emit(entry) {
    const tick = typeof entry.tick === 'number' ? entry.tick : _tick++;
    const line = `[${pad(tick)}] [${String(entry.domain || 'LOG').toUpperCase()}] ${entry.message}`;
    _bus.dispatchEvent(Object.assign(new Event('log'), { detail: { tick, domain: entry.domain, message: entry.message, line } }));
  },

  /**
   * Abonniert alle Log-Einträge.
   * @param {function({ tick, domain, message, line }): void} callback
   * @returns {function} unsubscribe
   */
  subscribe(callback) {
    const handler = (evt) => callback(evt.detail);
    _bus.addEventListener('log', handler);
    return () => _bus.removeEventListener('log', handler);
  },

  /**
   * Verbindet den LogBus mit einer Server-Session via SSE.
   * @param {string} sessionId
   * @returns {function} close — schließt die Verbindung
   */
  connectSSE(sessionId) {
    const es = new EventSource(`/api/patch-sessions/${encodeURIComponent(sessionId)}/events`);

    es.addEventListener('status', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        LogBus.emit({ domain: 'sse', message: `phase=${data.phase} state=${data.state || '–'}` });
      } catch {}
    });

    es.addEventListener('result', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        LogBus.emit({ domain: 'sse', message: `result=${data.finalStatus}` });
        es.close();
      } catch {}
    });

    es.onerror = () => {
      LogBus.emit({ domain: 'sse', message: 'Verbindung unterbrochen.' });
      es.close();
    };

    return () => es.close();
  }
});
