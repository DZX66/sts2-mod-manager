use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

fn profiles_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("STS2ModManager");
    let _ = fs::create_dir_all(&dir);
    dir.join("profiles.json")
}

#[tauri::command]
pub fn profiles_load() -> Value {
    let p = profiles_path();
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
pub fn profiles_save(profiles: Value) -> serde_json::Value {
    let p = profiles_path();
    if let Ok(json) = serde_json::to_string_pretty(&profiles) {
        let _ = fs::write(&p, json);
    }
    serde_json::json!({ "success": true })
}

// ── Profile Import / Export ──

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProfileExportMod {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    #[serde(rename = "workshopId")]
    pub workshop_id: Option<String>,
    #[serde(rename = "modType")]
    pub mod_type: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProfileExportData {
    pub name: String,
    pub version: u32,
    pub mods: Vec<ProfileExportMod>,
    pub snapshot: serde_json::Map<String, serde_json::Value>,
    #[serde(rename = "loadOrder")]
    pub load_order: Vec<String>,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
}

/// Build export data for a given profile name and current mods list
pub fn build_profile_export(
    profile_name: &str,
    profile_value: &Value,
    mods: &[crate::mods::ModInfo],
) -> ProfileExportData {
    let snapshot = profile_value
        .get("snapshot")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let load_order = profile_value
        .get("loadOrder")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .filter(|id| snapshot.contains_key(id))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let export_mods: Vec<ProfileExportMod> = mods
        .iter()
        .filter_map(|m| {
            let id = m.id.as_deref()?;
            // Only include mods that are in the profile snapshot
            if !snapshot.contains_key(id) {
                return None;
            }
            Some(ProfileExportMod {
                id: id.to_string(),
                name: m.name.clone().unwrap_or_else(|| id.to_string()),
                version: m.version.clone(),
                workshop_id: if m.mod_type.as_deref() == Some("steam_workshop") {
                    Some(m.folder_name.clone())
                } else {
                    None
                },
                mod_type: m.mod_type.clone(),
            })
        })
        .collect();

    ProfileExportData {
        name: profile_name.to_string(),
        version: 1,
        mods: export_mods,
        snapshot,
        load_order,
        exported_at: chrono::Utc::now().to_rfc3339(),
    }
}

#[tauri::command]
pub fn profile_export_json(
    profile_name: String,
    profile_value: Value,
    mods: Vec<crate::mods::ModInfo>,
) -> Result<String, String> {
    let export = build_profile_export(&profile_name, &profile_value, &mods);
    serde_json::to_string_pretty(&export).map_err(|e| format!("序列化失败: {}", e))
}

#[tauri::command]
pub async fn profile_export_file(
    app: tauri::AppHandle,
    profile_name: String,
    profile_value: Value,
    mods: Vec<crate::mods::ModInfo>,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let export = build_profile_export(&profile_name, &profile_value, &mods);
    let json = serde_json::to_string_pretty(&export).map_err(|e| format!("序列化失败: {}", e))?;

    let file = app
        .dialog()
        .file()
        .set_title("导出配置")
        .add_filter("JSON", &["json"])
        .set_file_name(format!("profile_{}.json", profile_name))
        .blocking_save_file();

    match file {
        Some(path) => {
            let p = path.to_string();
            std::fs::write(&p, &json).map_err(|e| format!("写入文件失败: {}", e))?;
            Ok(p)
        }
        None => Err("用户取消了操作".into()),
    }
}

#[tauri::command]
pub fn profile_import_parse(json_str: String) -> Result<ProfileExportData, String> {
    serde_json::from_str::<ProfileExportData>(&json_str)
        .map_err(|e| format!("解析失败: {}", e))
}

#[tauri::command]
pub async fn profile_import_file(app: tauri::AppHandle) -> Result<ProfileExportData, String> {
    use tauri_plugin_dialog::DialogExt;
    let file = app
        .dialog()
        .file()
        .set_title("导入配置")
        .add_filter("JSON", &["json"])
        .blocking_pick_file();

    let path = match file {
        Some(p) => p.to_string(),
        None => return Err("用户取消了操作".into()),
    };

    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))?;

    serde_json::from_str::<ProfileExportData>(&content)
        .map_err(|e| format!("解析失败: {}", e))
}

#[tauri::command]
pub fn profile_get_workshop_url(workshop_id: String) -> String {
    format!("steam://url/CommunityFilePage/{}", workshop_id)
}