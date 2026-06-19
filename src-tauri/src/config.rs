use crate::steam;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Config {
    #[serde(rename = "gamePath")]
    pub game_path: Option<String>,
    #[serde(rename = "smartInstall")]
    pub smart_install: Option<bool>,
    #[serde(rename = "steamId")]
    pub steam_id: Option<String>,
}

#[derive(Serialize)]
pub struct InitResult {
    #[serde(rename = "gamePath")]
    pub game_path: Option<String>,
    #[serde(rename = "modsDir")]
    pub mods_dir: Option<String>,
    #[serde(rename = "steamUsers")]
    pub steam_users: Vec<steam::SteamUser>,
    #[serde(rename = "selectedSteamId")]
    pub selected_steam_id: Option<String>,
    #[serde(rename = "workshopPath")]
    pub workshop_path: Option<String>,
    #[serde(rename = "smartInstall")]
    pub smart_install: Option<bool>,
}

fn config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("STS2ModManager")
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load_config() -> Config {
    let p = config_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(cfg) = serde_json::from_str(&content) {
                return cfg;
            }
        }
    }
    Config::default()
}

pub fn save_config(cfg: &Config) {
    let dir = config_dir();
    let _ = fs::create_dir_all(&dir);
    if let Ok(json) = serde_json::to_string_pretty(cfg) {
        let _ = fs::write(config_path(), json);
    }
}

fn detect_game_path() -> Option<String> {
    // Windows Steam library paths
    let steam_paths = vec![
        r"C:\Program Files (x86)\Steam",
        r"C:\Program Files\Steam",
        r"D:\Steam",
        r"D:\SteamLibrary",
        r"E:\SteamLibrary",
    ];

    for sp in &steam_paths {
        let vdf_path = Path::new(sp)
            .join("steamapps")
            .join("libraryfolders.vdf");
        if vdf_path.exists() {
            if let Ok(content) = fs::read_to_string(&vdf_path) {
                // Parse "path" entries from VDF
                for cap in content.lines() {
                    if let Some(start) = cap.find("\"path\"") {
                        let rest = &cap[start + 6..];
                        if let Some(s) = rest.find('"') {
                            let rest2 = &rest[s + 1..];
                            if let Some(e) = rest2.find('"') {
                                let lib_path = rest2[..e].replace("\\\\", "\\");
                                let game_dir = Path::new(&lib_path)
                                    .join("steamapps")
                                    .join("common")
                                    .join("Slay the Spire 2");
                                if game_dir.exists() {
                                    return Some(game_dir.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
        // Direct check
        let game_dir = Path::new(sp)
            .join("steamapps")
            .join("common")
            .join("Slay the Spire 2");
        if game_dir.exists() {
            return Some(game_dir.to_string_lossy().to_string());
        }
    }

    let direct_paths = vec![
        r"D:\SteamLibrary\steamapps\common\Slay the Spire 2",
        r"C:\Program Files (x86)\Steam\steamapps\common\Slay the Spire 2",
    ];
    for p in direct_paths {
        if Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    None
}

#[tauri::command]
pub fn app_get_version(config: tauri::Config) -> String {
    config.version.clone().unwrap_or_else(|| "1.0.0".to_string())
}

#[tauri::command]
pub fn app_init(state: tauri::State<'_, AppState>) -> InitResult {
    let cfg = load_config();
    let detected = if let Some(ref gp) = cfg.game_path {
        if Path::new(gp).exists() {
            Some(gp.clone())
        } else {
            detect_game_path()
        }
    } else {
        detect_game_path()
    };

    // Determine if this is a fresh config (first launch)
    let is_fresh_config = cfg.game_path.is_none() && cfg.steam_id.is_none();

    if let Some(ref gp) = detected {
        let mut state_gp = state.game_path.lock().unwrap();
        *state_gp = Some(gp.clone());
        // Persist if auto-detected (clone cfg to avoid move)
        if cfg.game_path.as_deref() != Some(gp.as_str()) {
            let mut new_cfg = cfg.clone();
            new_cfg.game_path = Some(gp.clone());
            save_config(&new_cfg);
        }
    }

    let mods_dir = detected
        .as_ref()
        .map(|p| Path::new(p).join("mods").to_string_lossy().to_string());

    // Scan Steam users
    let steam_users = steam::scan_steam_users();

    // On first launch, auto-select the first Steam user if available
    let selected_steam_id = if is_fresh_config || cfg.steam_id.is_none() {
        if !steam_users.is_empty() {
            let auto_id = Some(steam_users[0].steam_id.clone());
            // Persist the auto-selected steam ID
            let mut new_cfg = load_config();
            if new_cfg.steam_id.is_none() {
                new_cfg.steam_id = auto_id.clone();
                save_config(&new_cfg);
            }
            auto_id
        } else {
            cfg.steam_id.clone()
        }
    } else {
        cfg.steam_id.clone()
    };

    // Determine workshop path
    let workshop_path = detected.as_ref().and_then(|gp| {
        if gp.to_lowercase().contains("steamapps") {
            steam::find_workshop_path(gp)
        } else {
            None
        }
    });

    // On first launch, default smart_install to true
    let smart_install = if is_fresh_config {
        let mut new_cfg = load_config();
        new_cfg.smart_install = Some(true);
        save_config(&new_cfg);
        Some(true)
    } else {
        cfg.smart_install
    };

    InitResult {
        game_path: detected,
        mods_dir,
        steam_users,
        selected_steam_id,
        workshop_path,
        smart_install,
    }
}

#[tauri::command]
pub async fn app_select_game_path(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Option<InitResult>, String> {
    let dialog = app.dialog();
    let folder = dialog
        .file()
        .set_title("选择 Slay the Spire 2 游戏目录")
        .blocking_pick_folder();

    if let Some(folder_path) = folder {
        let gp = folder_path.to_string();
        let mut state_gp = state.game_path.lock().unwrap();
        *state_gp = Some(gp.clone());

        let mut cfg = load_config();
        cfg.game_path = Some(gp.clone());
        save_config(&cfg);

        let mods_dir = Path::new(&gp).join("mods").to_string_lossy().to_string();

        // Scan Steam users
        let steam_users = steam::scan_steam_users();
        let cfg_after = load_config();

        let workshop_path = if gp.to_lowercase().contains("steamapps") {
            steam::find_workshop_path(&gp)
        } else {
            None
        };

        Ok(Some(InitResult {
            game_path: Some(gp),
            mods_dir: Some(mods_dir),
            steam_users,
            selected_steam_id: cfg_after.steam_id,
            workshop_path,
            smart_install: cfg_after.smart_install,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn config_get() -> Config {
    load_config()
}

#[tauri::command]
pub fn config_set(new_config: Config) {
    save_config(&new_config);
}