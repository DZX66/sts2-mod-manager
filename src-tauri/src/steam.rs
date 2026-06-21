use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// A Steam user profile with its ID and settings
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SteamUser {
    pub steam_id: String,
}

/// An entry in the mod_list from settings.save
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModListEntry {
    pub id: String,
    pub is_enabled: bool,
    pub source: String,
}

/// Structure of settings.save
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SettingsSave {
    pub mod_settings: Option<ModSettings>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModSettings {
    pub mod_list: Option<Vec<ModListEntry>>,
}

/// Result of scanning workshop mods
#[derive(Serialize, Clone, Debug)]
pub struct WorkshopModInfo {
    pub id: Option<String>,
    pub name: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub folder_name: String,
    pub path: String,
    pub enabled: bool,
}

/// Get the Steam settings directory: %AppData%/SlayTheSpire2/steam/
fn get_steam_settings_dir() -> Option<PathBuf> {
    let base = dirs::config_dir()?;
    Some(base.join("SlayTheSpire2").join("steam"))
}

/// Scan the steam settings directory for available Steam user IDs
pub fn scan_steam_users() -> Vec<SteamUser> {
    let settings_dir = match get_steam_settings_dir() {
        Some(d) => d,
        None => return vec![],
    };

    if !settings_dir.exists() {
        return vec![];
    }

    let mut users = Vec::new();
    if let Ok(entries) = fs::read_dir(&settings_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    // Steam IDs are numeric (typically 17 digits)
                    if dir_name.chars().all(|c| c.is_ascii_digit()) && dir_name.len() >= 15 {
                        users.push(SteamUser {
                            steam_id: dir_name.to_string(),
                        });
                    }
                }
            }
        }
    }
    users.sort_by(|a, b| a.steam_id.cmp(&b.steam_id));
    users
}

/// Read settings.save for a given Steam user and extract workshop mod entries
pub fn read_workshop_mod_config(steam_id: &str) -> Vec<ModListEntry> {
    let settings_dir = match get_steam_settings_dir() {
        Some(d) => d,
        None => return vec![],
    };

    let settings_file = settings_dir.join(steam_id).join("settings.save");
    if !settings_file.exists() {
        return vec![];
    }

    let content = match fs::read_to_string(&settings_file) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let save: SettingsSave = match serde_json::from_str(&content) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let workshop_mods = save
        .mod_settings
        .and_then(|ms| ms.mod_list)
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| entry.source == "steam_workshop")
        .collect();

    workshop_mods
}

/// Update is_enabled for a workshop mod in settings.save
/// Uses serde_json::Value to preserve all other fields in the file
pub fn toggle_workshop_mod(steam_id: &str, mod_id: &str, enabled: bool) -> Result<(), String> {
    let settings_dir = get_steam_settings_dir().ok_or("找不到 Steam 设置目录")?;
    let settings_file = settings_dir.join(steam_id).join("settings.save");
    if !settings_file.exists() {
        return Err("找不到 settings.save 文件".into());
    }

    let content = fs::read_to_string(&settings_file).map_err(|e| format!("读取 settings.save 失败: {}", e))?;
    let mut root: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 settings.save 失败: {}", e))?;

    // Ensure mod_settings.mod_list path exists in the JSON tree
    {
        let root_obj = root.as_object_mut().ok_or("settings.save 不是 JSON 对象")?;
        if !root_obj.contains_key("mod_settings") {
            root_obj.insert("mod_settings".to_string(), serde_json::json!({"mod_list": []}));
        }
        let mod_settings = root_obj.get_mut("mod_settings").unwrap();
        let ms_obj = mod_settings.as_object_mut().ok_or("mod_settings 不是对象")?;
        if !ms_obj.contains_key("mod_list") {
            ms_obj.insert("mod_list".to_string(), serde_json::Value::Array(vec![]));
        }
        let mod_list = ms_obj.get_mut("mod_list").unwrap();
        let arr = mod_list.as_array_mut().ok_or("mod_list 不是数组")?;

        if let Some(entry) = arr.iter_mut().find(|e| e.get("id").and_then(|v| v.as_str()) == Some(mod_id)) {
            entry["is_enabled"] = serde_json::Value::Bool(enabled);
            if entry.get("source").is_none() {
                entry["source"] = serde_json::Value::String("steam_workshop".to_string());
            }
        } else {
            arr.push(serde_json::json!({
                "id": mod_id,
                "is_enabled": enabled,
                "source": "steam_workshop"
            }));
        }
    }

    let json =
        serde_json::to_string_pretty(&root).map_err(|e| format!("序列化 settings.save 失败: {}", e))?;
    fs::write(&settings_file, json).map_err(|e| format!("写入 settings.save 失败: {}", e))?;

    Ok(())
}

/// Try to find the workshop path based on the game installation path
/// Example: game_path = "D:/steam/steamapps/common/Slay the Spire 2"
/// -> workshop_path = "D:/steam/steamapps/workshop/content/2868840"
pub fn find_workshop_path(game_path: &str) -> Option<String> {
    // Check if game is installed via Steam (path contains "steamapps")
    let game_path_lower = game_path.to_lowercase();
    if !game_path_lower.contains("steamapps") {
        return None;
    }

    // Navigate up from game installation to find steamapps
    if let Some(steamapps_idx) = game_path_lower.find("steamapps") {
        let steamapps_root = &game_path[..steamapps_idx + 9]; // includes "steamapps"
        let candidate = Path::new(steamapps_root)
            .join("workshop")
            .join("content")
            .join("2868840"); // STS2's app ID

        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }

        // Also try common alternative paths
        // Look for libraryfolders.vdf to find other library locations
        let vdf_path = Path::new(steamapps_root).join("libraryfolders.vdf");
        if vdf_path.exists() {
            if let Ok(content) = fs::read_to_string(&vdf_path) {
                for line in content.lines() {
                    if let Some(start) = line.find("\"path\"") {
                        let rest = &line[start + 6..];
                        if let Some(s) = rest.find('"') {
                            let rest2 = &rest[s + 1..];
                            if let Some(e) = rest2.find('"') {
                                let lib_path = rest2[..e].replace("\\\\", "\\");
                                let workshop_dir = Path::new(&lib_path)
                                    .join("steamapps")
                                    .join("workshop")
                                    .join("content")
                                    .join("2868840");
                                if workshop_dir.exists() {
                                    return Some(workshop_dir.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }

        // Return the path even if it doesn't exist (user may need to subscribe first)
        return Some(candidate.to_string_lossy().to_string());
    }

    None
}

/// Scan the workshop content directory for mods
/// Each mod is a subfolder containing JSON manifest files
/// Mods that exist in the workshop folder but are NOT listed in settings.save defualt to enabled
pub fn scan_workshop_mods(workshop_path: &str, known_entries: &[ModListEntry]) -> Vec<WorkshopModInfo> {
    let workshop_dir = Path::new(workshop_path);
    if !workshop_dir.exists() {
        return vec![];
    }

    let mut mods = Vec::new();

    if let Ok(entries) = fs::read_dir(workshop_dir) {
        for entry in entries.flatten() {
            let mod_path = entry.path();
            if !mod_path.is_dir() {
                continue;
            }

            let folder_name = mod_path
                .file_name()
                .and_then(|n| n.to_str())
                .map(|s| s.to_string())
                .unwrap_or_default();

            // Recursively search for JSON manifest files in this mod's folder
            let json_files = find_json_files_recursive(&mod_path);

            for json_path in &json_files {
                if let Some(content) = read_json_file(json_path) {
                    if content.get("id").and_then(|v| v.as_str()).is_some()
                        && content.get("name").and_then(|v| v.as_str()).is_some()
                    {
                        let mod_id = content.get("id").and_then(|v| v.as_str()).map(String::from);
                        let is_enabled = if let Some(ref id) = mod_id {
                            // If mod is in settings.save, use its enabled status
                            // If mod is NOT in settings.save, default to enabled
                            if let Some(entry) = known_entries.iter().find(|e| e.id == *id) {
                                entry.is_enabled
                            } else {
                                true
                            }
                        } else {
                            false
                        };

                        mods.push(WorkshopModInfo {
                            id: mod_id,
                            name: content.get("name").and_then(|v| v.as_str()).map(String::from),
                            author: content.get("author").and_then(|v| v.as_str()).map(String::from),
                            version: content.get("version").and_then(|v| v.as_str()).map(|s| {
                                s.strip_prefix('v').or_else(|| s.strip_prefix('V')).unwrap_or(s).to_string()
                            }),
                            description: content.get("description").and_then(|v| v.as_str()).map(String::from),
                            folder_name,
                            path: mod_path.to_string_lossy().to_string(),
                            enabled: is_enabled,
                        });
                        break; // Only take the first valid manifest
                    }
                }
            }
        }
    }

    mods
}

fn find_json_files_recursive(dir: &Path) -> Vec<PathBuf> {
    let mut results = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                results.extend(find_json_files_recursive(&path));
            } else if path.extension().map(|e| e == "json").unwrap_or(false) {
                results.push(path);
            }
        }
    }
    results
}

fn read_json_file(path: &Path) -> Option<serde_json::Value> {
    let mut content = fs::read_to_string(path).ok()?;
    // Strip BOM
    if content.starts_with('\u{feff}') {
        content = content[3..].to_string();
    }
    serde_json::from_str(&content).ok()
}

/// Convert a WorkshopModInfo to a full ModInfo (for merging with the mod list)
pub fn workshop_to_modinfo(ws: &WorkshopModInfo) -> crate::mods::ModInfo {
    // Calculate size by scanning the folder
    let size = dir_size(Path::new(&ws.path));

    // Scan for DLL and PCK files in the workshop mod folder
    let has_dll = scan_for_files(Path::new(&ws.path), ".dll");
    let has_pck = scan_for_files(Path::new(&ws.path), ".pck");

    crate::mods::ModInfo {
        id: ws.id.clone(),
        name: ws.name.clone(),
        author: ws.author.clone(),
        version: ws.version.clone(),
        description: ws.description.clone(),
        dependencies: None,
        affects_gameplay: None, // Let smart sort decide purely from file types
        min_game_version: None,
        has_dll: Some(has_dll),
        has_pck: Some(has_pck),
        enabled: ws.enabled,
        instance_key: format!("steam_workshop::{}", ws.folder_name),
        folder_name: ws.folder_name.clone(),
        is_folder: true,
        path: ws.path.clone(),
        files: vec![],
        size,
        mod_type: Some("steam_workshop".to_string()),
    }
}

/// Scan a directory recursively for files with a given extension (".dll" or ".pck")
fn scan_for_files(dir: &Path, ext: &str) -> bool {
    let target = if ext == ".dll" { "dll" } else { "pck" };
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if scan_for_files(&path, ext) {
                    return true;
                }
            } else if let Some(e) = path.extension() {
                if e == target {
                    return true;
                }
            }
        }
    }
    false
}

fn dir_size(path: &Path) -> u64 {
    let mut size = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                size += dir_size(&p);
            } else if let Ok(meta) = p.metadata() {
                size += meta.len();
            }
        }
    }
    size
}