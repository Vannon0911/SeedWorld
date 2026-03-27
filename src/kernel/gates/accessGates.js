/**
 * Access Gates: game.access, dev.access, patcher.access
 * Reine Validatoren — kein Date.now(), kein window, kein process.env
 */

export function validateGameAccess(context, kernelInterface) {
  const hasGameLogic = !!(context.gameLogic || kernelInterface('game.exists'));
  const systemReady = kernelInterface('system.ready');
  return {
    valid: hasGameLogic && systemReady,
    reason: !hasGameLogic ? 'Game-Logik nicht verfuegbar' : 'System nicht bereit'
  };
}

export function validateDevAccess(context, kernelInterface) {
  const hasDevTools = !!(context.kernelInterface || kernelInterface('dev.available'));
  const devEnabled = !!(context.devEnabled);
  return {
    valid: devEnabled && hasDevTools,
    reason: !devEnabled ? 'Dev-Modus nicht aktiviert' : 'Dev-Tools nicht verfuegbar'
  };
}

export function validatePatcherAccess(context, kernelInterface) {
  const hasPatchSystem = kernelInterface('patch.system.available');
  const userCanPatch = kernelInterface('user.can_patch');
  return {
    valid: hasPatchSystem && userCanPatch,
    reason: !hasPatchSystem ? 'Patch-System nicht verfuegbar' : 'Fehlende Patch-Berechtigung'
  };
}
