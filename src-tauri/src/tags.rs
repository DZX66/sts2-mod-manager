use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn tags_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("STS2ModManager");
    let _ = fs::create_dir_all(&dir);
    dir.join("tags.json")
}

#[tauri::command]
pub fn tags_load() -> Value {
    let p = tags_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(val) = serde_json::from_str(&content) {
                return val;
            }
        }
    }
    serde_json::json!({
        "modTags": {},
        "tagColors": {}
    })
}

#[tauri::command]
pub fn tags_save(data: Value) -> Value {
    let p = tags_path();
    if let Ok(json) = serde_json::to_string_pretty(&data) {
        let _ = fs::write(&p, json);
    }
    serde_json::json!({ "success": true })
}