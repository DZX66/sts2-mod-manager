// Tauri API bridge - replaces Electron's preload.js
// Provides the same window.api interface using Tauri invoke

const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

const appWindow = getCurrentWindow();

// Game state polling
let gameStateCallback = null;
let gameExitedCallback = null;
let pollingInterval = null;
let lastGameState = 'idle';

function startGameStatePolling() {
  if (pollingInterval) return;
  pollingInterval = setInterval(async () => {
    try {
      const state = await invoke('game_get_state');
      if (state !== lastGameState) {
        const prevState = lastGameState;
        lastGameState = state;
        if (gameStateCallback) gameStateCallback(state);
        // Detect game exit
        if (prevState === 'running' && state === 'idle') {
          if (gameExitedCallback) gameExitedCallback({ quick: false });
        }
        if (prevState === 'launching' && state === 'idle') {
          if (gameExitedCallback) gameExitedCallback({ quick: true });
        }
      }
      // Stop polling if idle
      if (state === 'idle' && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    } catch (e) {
      // ignore polling errors
    }
  }, 2000);
}

window.api = {
  // App
  init: () => invoke('app_init'),
  getAppVersion: () => invoke('app_get_version'),
  selectGamePath: () => invoke('app_select_game_path'),
  getConfig: () => invoke('config_get'),
  setConfig: (config) => invoke('config_set', { newConfig: config }),

  // Window
  minimize: () => invoke('window_minimize'),
  maximize: () => invoke('window_maximize'),
  close: () => invoke('window_close'),

  // Mods
  scanMods: () => invoke('mods_scan'),
  toggleMod: (modInfo) => invoke('mods_toggle', { modInfo: { isFolder: modInfo.isFolder, folderName: modInfo.folderName, files: modInfo.files, enabled: !modInfo.enabled, modId: modInfo.id, modType: modInfo.modType } }),
  uninstallMod: (modInfo) => invoke('mods_uninstall', { modInfo: { isFolder: modInfo.isFolder, folderName: modInfo.folderName, files: modInfo.files, enabled: modInfo.enabled, modId: modInfo.id, modType: modInfo.modType } }),
  installMod: () => invoke('mods_install'),
  installDrop: (filePaths) => invoke('mods_install_drop', { filePaths }),
  backupMods: () => invoke('mods_backup'),
  restoreMods: () => invoke('mods_restore'),

  // Shell
  openModsDir: () => invoke('shell_open_mods_dir'),
  openGameDir: () => invoke('shell_open_game_dir'),
  openLogsDir: () => invoke('shell_open_logs_dir'),
  openSavesDir: () => invoke('shell_open_saves_dir'),
  openUrl: (url) => invoke('shell_open_url', { url }),
  openPath: (path) => invoke('shell_open_path', { path }),

  // Game
  launchGame: async () => {
    const result = await invoke('game_launch');
    if (result.success) {
      lastGameState = 'launching';
      startGameStatePolling();
    }
    return result;
  },
  getGameState: () => invoke('game_get_state'),
  getGameVersion: () => invoke('game_get_version'),
  analyzeCrash: () => invoke('game_analyze_crash'),
  onGameStateChanged: (cb) => { gameStateCallback = cb; },
  onGameExited: (cb) => { gameExitedCallback = cb; },

  // Logs
  getLatestLogs: () => invoke('logs_get_latest'),
  readLog: (fileName) => invoke('logs_read', { fileName }),

  // Profiles
  loadProfiles: () => invoke('profiles_load'),
  saveProfiles: (profiles) => invoke('profiles_save', { profiles }),

  // Translate
  translateText: (text) => invoke('translate_text', { text }),
  loadTranslations: () => invoke('translations_load'),
  saveTranslations: (data) => invoke('translations_save', { data }),

  // Mod notes
  loadModNotes: () => invoke('mods_notes_load'),
  saveModNotes: (data) => invoke('mods_notes_save', { data }),

  // Steam Workshop
  getSteamUsers: () => invoke('steam_get_users'),
  selectSteamUser: (steamId) => invoke('steam_select_user', { steamId }),

  // Saves
  scanSaves: () => invoke('saves_scan'),
  exportSave: (opts) => invoke('saves_export', { opts }),
  importSave: (opts) => invoke('saves_import', { opts }),
  deleteBackup: (backupPath) => invoke('saves_delete_backup', { backupPath }),
};
