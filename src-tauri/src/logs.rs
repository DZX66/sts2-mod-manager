use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_LOG_FILES: usize = 50;

#[derive(Serialize)]
pub struct LogsResult {
    pub files: Vec<String>,
    pub content: String,
}

fn get_logs_dir() -> Option<std::path::PathBuf> {
    let appdata = dirs::config_dir()?;
    let dir = appdata.join("SlayTheSpire2").join("logs");
    if dir.exists() {
        Some(dir)
    } else {
        None
    }
}

fn read_log_safe(path: &Path) -> String {
    if !path.exists() {
        return String::new();
    }
    fs::read_to_string(path).unwrap_or_default()
}

#[tauri::command]
pub fn logs_get_latest() -> LogsResult {
    let logs_dir = match get_logs_dir() {
        Some(d) => d,
        None => return LogsResult { files: vec![], content: String::new() },
    };

    let mut files: Vec<(String, u64)> = Vec::new();
    if let Ok(entries) = fs::read_dir(&logs_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".log") {
                if let Ok(meta) = entry.metadata() {
                    let mtime = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                    files.push((name, mtime));
                }
            }
        }
    }
    files.sort_by(|a, b| b.1.cmp(&a.1));
    let file_names: Vec<String> = files.into_iter().take(MAX_LOG_FILES).map(|(n, _)| n).collect();

    let content = if !file_names.is_empty() {
        read_log_safe(&logs_dir.join(&file_names[0]))
    } else {
        String::new()
    };

    LogsResult {
        files: file_names,
        content,
    }
}

#[tauri::command]
pub fn logs_read(file_name: String) -> String {
    let logs_dir = match get_logs_dir() {
        Some(d) => d,
        None => return String::new(),
    };
    read_log_safe(&logs_dir.join(&file_name))
}

// ── Character name mapping (mod characters) ──

fn character_names_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("STS2ModManager");
    let _ = fs::create_dir_all(&dir);
    dir.join("character_names.json")
}

fn load_character_names() -> HashMap<String, String> {
    let p = character_names_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&content) {
                return map;
            }
        }
    }
    HashMap::new()
}

fn save_character_names(map: &HashMap<String, String>) {
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = fs::write(character_names_path(), json);
    }
}

/// Extract "CHARACTER.X" from "Embarking on a singleplayer X run."
fn extract_embark_role(line: &str) -> Option<String> {
    const PREFIX: &str = "Embarking on a singleplayer ";
    let start = line.find(PREFIX)? + PREFIX.len();
    let rest = &line[start..];
    let end = rest.find(" run.")?;
    let id = rest[..end].trim();
    if id.is_empty() {
        return None;
    }
    Some(format!("CHARACTER.{}", id))
}

/// Extract the localized target name from "... using potion X (targeting Y (index 0))"
fn extract_potion_target(line: &str) -> Option<String> {
    const MARKER: &str = "using potion ";
    let start = line.find(MARKER)? + MARKER.len();
    let rest = &line[start..];
    let target_start = rest.find(" (targeting ")? + " (targeting ".len();
    let target_rest = &rest[target_start..];
    let end = target_rest.find(" (index 0))")?;
    let target = target_rest[..end].trim();
    if target.is_empty() {
        return None;
    }
    Some(target.to_string())
}

/// Scan godot.log (and rotated logs, newest first) to learn which localized name
/// corresponds to which mod character id. Persists discovered mappings so they
/// survive restarts.
#[tauri::command]
pub fn character_names_scan() -> serde_json::Value {
    let mut map = load_character_names();
    let mut changed = false;

    if let Some(logs_dir) = get_logs_dir() {
        // Collect godot logs (current + rotated), newest first
        let mut files: Vec<(String, u64)> = Vec::new();
        if let Ok(entries) = fs::read_dir(&logs_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if (name == "godot.log" || (name.starts_with("godot") && name.ends_with(".log")))
                    && !name.ends_with(".tmp")
                {
                    if let Ok(meta) = entry.metadata() {
                        let mtime = meta
                            .modified()
                            .ok()
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0);
                        files.push((name, mtime));
                    }
                }
            }
        }
        files.sort_by(|a, b| b.1.cmp(&a.1));

        for (name, _) in &files {
            let content = read_log_safe(&logs_dir.join(name));
            let mut current_role: Option<String> = None;
            for line in content.lines() {
                if line.contains("Time to main menu") {
                    current_role = None;
                    continue;
                }
                if let Some(role) = extract_embark_role(line) {
                    current_role = Some(role);
                    continue;
                }
                if let (Some(role), Some(target)) =
                    (current_role.as_ref(), extract_potion_target(line))
                {
                    if map.get(role).map(|v| v != &target).unwrap_or(true) {
                        map.insert(role.clone(), target);
                        changed = true;
                    }
                }
            }
        }
    }

    if changed {
        save_character_names(&map);
    }

    serde_json::to_value(map).unwrap_or_else(|_| serde_json::json!({}))
}
