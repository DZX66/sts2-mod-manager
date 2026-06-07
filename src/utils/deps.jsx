/**
 * Compare two semantic version strings (e.g., "3.1.2", "0.2.31")
 * Returns:
 *   1 if version1 > version2
 *  -1 if version1 < version2
 *   0 if equal
 */
export function compareVersions(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Check if a dependency is satisfied by the currently enabled mods.
 * A dependency is satisfied when:
 *   1. The dependency mod exists and is enabled
 *   2. If min_version is specified, the dep mod's version >= min_version
 *
 * @param {object} dep - { id: string, min_version?: string }
 * @param {Array} allMods - All mods with their id, enabled, version fields
 * @returns {{ satisfied: boolean, reason?: string }}
 */
export function checkDepSatisfied(dep, allMods) {
  const depMod = allMods.find(m => m.id === dep.id);
  if (!depMod) {
    return { satisfied: false, reason: 'uninstalled' };
  }
  if (!depMod.enabled) {
    return { satisfied: false, reason: 'disabled' };
  }
  if (dep.min_version) {
    const cmp = compareVersions(depMod.version, dep.min_version);
    if (cmp < 0) {
      return { satisfied: false, reason: 'version_mismatch' };
    }
  }
  return { satisfied: true };
}

/**
 * Get list of unsatisfied dependencies for a mod.
 * @returns {Array<{ id: string, reason: string, dep: object }>}
 */
export function getUnsatisfiedDeps(mod, allMods) {
  if (!mod.dependencies || mod.dependencies.length === 0) return [];
  return mod.dependencies
    .map(dep => {
      const result = checkDepSatisfied(dep, allMods);
      return { ...result, id: dep.id, dep };
    })
    .filter(r => !r.satisfied);
}

/**
 * Check if a mod's min_game_version requirement is satisfied by the current game version.
 * Returns null if no min_game_version is specified, or the check result otherwise.
 */
export function checkMinGameVersion(mod, gameVersion) {
  if (!mod.min_game_version || !gameVersion) return null;
  const cmp = compareVersions(gameVersion, mod.min_game_version);
  return cmp >= 0;
}
