/**
 * Operation Gates: patch.apply, kernel.tick, state.modify, system.reset, system.shutdown
 * Reine Validatoren — kein Date.now(), kein window, kein process.env
 */

export function validatePatchApply(context, kernelInterface) {
  const patchData = context.patchData;
  if (!patchData) return { valid: false, reason: 'Keine Patch-Daten uebermittelt' };
  for (const field of ['id', 'version', 'schema']) {
    if (!patchData[field]) return { valid: false, reason: `Pflichtfeld fehlt: ${field}` };
  }
  const existing = kernelInterface('patch.get', patchData.id);
  if (existing && existing.version >= patchData.version) {
    return { valid: false, reason: `Patch-Version ${patchData.version} ist nicht neuer als ${existing.version}` };
  }
  return { valid: true };
}

export function validateTickOperation(context, kernelInterface) {
  const { tickCount } = context;
  if (typeof tickCount !== 'number' || tickCount <= 0) return { valid: false, reason: 'Ungueltige Tick-Anzahl' };
  if (!kernelInterface('tick.can_advance')) return { valid: false, reason: 'System kann Tick nicht vorrücken' };
  return { valid: true };
}

export function validateStateModification(context, kernelInterface) {
  const { modification } = context;
  if (!modification || typeof modification !== 'object') return { valid: false, reason: 'Ungültiges Modifications-Objekt' };
  if (!kernelInterface('state.can_modify', modification)) return { valid: false, reason: 'State-Änderung nicht erlaubt' };
  return { valid: true };
}

export function validateSystemReset(context, kernelInterface) {
  if (!kernelInterface('system.can_reset')) return { valid: false, reason: 'System-Reset nicht erlaubt' };
  return { valid: true };
}

export function validateSystemShutdown(context, kernelInterface) {
  if (!kernelInterface('system.can_shutdown')) return { valid: false, reason: 'System-Shutdown nicht erlaubt' };
  return { valid: true };
}
