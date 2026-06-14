use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn notes_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("STS2ModManager");
    let _ = fs::create_dir_all(&dir);
    dir.join("notes.json")
}

#[tauri::command]
pub fn mods_notes_load() -> Value {
    let p = notes_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(val) = serde_json::from_str(&content) {
                return val;
            }
        }
    }
    serde_json::json!({})
}

#[tauri::command]
pub fn mods_notes_save(data: Value) -> Value {
    let p = notes_path();
    if let Ok(json) = serde_json::to_string_pretty(&data) {
        let _ = fs::write(&p, json);
    }
    serde_json::json!({ "success": true })
}