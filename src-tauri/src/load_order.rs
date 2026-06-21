use crate::config;
use crate::mods;
use crate::AppState;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoadOrderEntry {
    pub id: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LoadOrderData {
    pub order: Vec<String>,
}

#[derive(Serialize)]
pub struct LoadOrderResult {
    pub success: bool,
    pub error: Option<String>,
    pub load_order: Option<Vec<String>>,
}

// ── Persistence ──

fn load_order_config_path() -> std::path::PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let dir = base.join("STS2ModManager");
    let _ = fs::create_dir_all(&dir);
    dir.join("load_order.json")
}

fn load_load_order_file() -> Vec<String> {
    let p = load_order_config_path();
    if p.exists() {
        if let Ok(content) = fs::read_to_string(&p) {
            if let Ok(data) = serde_json::from_str::<LoadOrderData>(&content) {
                return data.order;
            }
        }
    }
    vec![]
}

fn save_load_order_file(order: &[String]) -> Result<(), String> {
    let p = load_order_config_path();
    let data = LoadOrderData { order: order.to_vec() };
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&p, json).map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

// ── Smart Sort ──

fn get_mod_category(mod_info: &mods::ModInfo, all_mods: &[mods::ModInfo]) -> u8 {
    let is_framework = all_mods.iter().any(|m| {
        m.id.as_ref().map_or(false, |m_id| m_id != mod_info.id.as_deref().unwrap_or(""))
            && m.dependencies.as_ref().map_or(false, |deps| {
                deps.iter().any(|d| d.id == mod_info.id.as_deref().unwrap_or(""))
            })
    });
    if is_framework { return 0; }

    let has_dll = mod_info.has_dll.unwrap_or(false);
    let has_pck = mod_info.has_pck.unwrap_or(false);
    let affects_gameplay = mod_info.affects_gameplay.unwrap_or(false);

    if !affects_gameplay { return 3; }
    if affects_gameplay || has_dll { return 1; }
    2
}

fn smart_sort_mods(mods_list: &[mods::ModInfo]) -> Vec<String> {
    let mut with_category: Vec<(u8, &mods::ModInfo)> = mods_list
        .iter().map(|m| (get_mod_category(m, mods_list), m)).collect();
    with_category.sort_by(|a, b| {
        a.0.cmp(&b.0).then(
            a.1.name.as_deref().unwrap_or("").to_lowercase()
                .cmp(&b.1.name.as_deref().unwrap_or("").to_lowercase())
        )
    });
    with_category.iter()
        .filter(|(_, m)| m.enabled)
        .filter_map(|(_, m)| m.id.clone())
        .collect()
}

// ── Write to settings.save ──

/// Build mod_list: only enabled mods + disabled workshop mods.
fn build_settings_mod_list(load_order: &[String], all_mods: &[mods::ModInfo]) -> Vec<serde_json::Value> {
    let mut list: Vec<serde_json::Value> = Vec::new();
    let mut added = std::collections::HashSet::new();

    // 1) Load order items
    for mod_id in load_order {
        if added.contains(mod_id) { continue; }
        if let Some(m) = all_mods.iter().find(|m| m.id.as_deref() == Some(mod_id)) {
            if !m.enabled && m.mod_type.as_deref() != Some("steam_workshop") { continue; }
            added.insert(mod_id.clone());
            let source = if m.mod_type.as_deref() == Some("steam_workshop") { "steam_workshop" } else { "mods_directory" };
            list.push(serde_json::json!({"id": mod_id, "is_enabled": m.enabled, "source": source}));
        }
    }

    // 2) Remaining enabled + disabled workshop
    for m in all_mods {
        if let Some(ref id) = m.id {
            if added.contains(id) { continue; }
            if !m.enabled && m.mod_type.as_deref() != Some("steam_workshop") { continue; }
            added.insert(id.clone());
            let source = if m.mod_type.as_deref() == Some("steam_workshop") { "steam_workshop" } else { "mods_directory" };
            list.push(serde_json::json!({"id": id, "is_enabled": m.enabled, "source": source}));
        }
    }
    list
}

pub fn write_load_order_to_settings_save(load_order: &[String], game_path: &str) -> Result<(), String> {
    let all_mods = mods::full_mods_scan(game_path);
    let mod_list = build_settings_mod_list(load_order, &all_mods);

    let cfg = config::load_config();
    let steam_id = cfg.steam_id.ok_or_else(|| "未选择 Steam 用户".to_string())?;

    let settings_file = dirs::config_dir()
        .ok_or_else(|| "找不到 AppData 目录".to_string())?
        .join("SlayTheSpire2").join("steam").join(&steam_id).join("settings.save");
    if !settings_file.exists() {
        return Err("找不到 settings.save 文件".into());
    }

    let content = fs::read_to_string(&settings_file).map_err(|e| format!("读取失败: {}", e))?;
    let mut root: serde_json::Value = serde_json::from_str(&content).map_err(|e| format!("解析失败: {}", e))?;

    {
        let root_obj = root.as_object_mut().ok_or("settings.save 不是 JSON 对象")?;
        if !root_obj.contains_key("mod_settings") {
            root_obj.insert("mod_settings".to_string(), serde_json::json!({"mod_list": [], "mods_enabled": true}));
        }
        let ms = root_obj.get_mut("mod_settings").unwrap().as_object_mut().ok_or("mod_settings 不是对象")?;
        ms.insert("mod_list".to_string(), serde_json::Value::Array(mod_list));
        ms.insert("mods_enabled".to_string(), serde_json::Value::Bool(true));
    }

    // Use pretty format to keep file readable
    let json = serde_json::to_string_pretty(&root).map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&settings_file, json).map_err(|e| format!("写入失败: {}", e))?;
    Ok(())
}

// ── Tauri Commands ──

#[tauri::command]
pub fn load_order_get(state: tauri::State<'_, AppState>) -> LoadOrderResult {
    LoadOrderResult { success: true, error: None, load_order: Some(load_load_order_file()) }
}

#[tauri::command]
pub fn load_order_set(state: tauri::State<'_, AppState>, order: Vec<String>) -> LoadOrderResult {
    match save_load_order_file(&order) {
        Ok(()) => LoadOrderResult { success: true, error: None, load_order: Some(order) },
        Err(e) => LoadOrderResult { success: false, error: Some(e), load_order: None },
    }
}

#[tauri::command]
pub fn load_order_smart_sort(state: tauri::State<'_, AppState>) -> LoadOrderResult {
    let gp = state.game_path.lock().unwrap();
    let game_path = match &*gp {
        Some(p) => p.clone(),
        None => return LoadOrderResult { success: false, error: Some("游戏路径未设置".into()), load_order: None },
    };
    drop(gp);
    let all_mods = mods::full_mods_scan(&game_path);
    let sorted = smart_sort_mods(&all_mods);
    if let Err(e) = save_load_order_file(&sorted) {
        return LoadOrderResult { success: false, error: Some(e), load_order: None };
    }
    LoadOrderResult { success: true, error: None, load_order: Some(sorted) }
}

#[tauri::command]
pub fn load_order_export(order_str: String) -> Result<String, String> {
    let parsed: Vec<String> = serde_json::from_str(&order_str).map_err(|e| format!("无效数据: {}", e))?;
    serde_json::to_string_pretty(&parsed).map_err(|e| format!("序列化失败: {}", e))
}

#[tauri::command]
pub fn load_order_import(json_str: String) -> LoadOrderResult {
    match serde_json::from_str::<Vec<String>>(&json_str) {
        Ok(parsed) => match save_load_order_file(&parsed) {
            Ok(()) => LoadOrderResult { success: true, error: None, load_order: Some(parsed) },
            Err(e) => LoadOrderResult { success: false, error: Some(e), load_order: None },
        },
        Err(e) => LoadOrderResult { success: false, error: Some(format!("解析失败: {}", e)), load_order: None },
    }
}

#[tauri::command]
pub async fn load_order_export_file(
    app: tauri::AppHandle,
    order_str: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let parsed: Vec<String> =
        serde_json::from_str(&order_str).map_err(|e| format!("无效数据: {}", e))?;
    let json = serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("序列化失败: {}", e))?;

    let file = app
        .dialog()
        .file()
        .set_title("导出加载顺序")
        .add_filter("JSON", &["json"])
        .set_file_name("load_order.json")
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
pub async fn load_order_import_file(
    app: tauri::AppHandle,
) -> LoadOrderResult {
    use tauri_plugin_dialog::DialogExt;
    let file = app
        .dialog()
        .file()
        .set_title("导入加载顺序")
        .add_filter("JSON", &["json"])
        .blocking_pick_file();

    let path = match file {
        Some(p) => p.to_string(),
        None => return LoadOrderResult { success: false, error: Some("用户取消了操作".into()), load_order: None },
    };

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => return LoadOrderResult { success: false, error: Some(format!("读取文件失败: {}", e)), load_order: None },
    };

    let parsed: Vec<String> = match serde_json::from_str(&content) {
        Ok(p) => p,
        Err(e) => return LoadOrderResult { success: false, error: Some(format!("解析失败: {}", e)), load_order: None },
    };

    match save_load_order_file(&parsed) {
        Ok(()) => LoadOrderResult { success: true, error: None, load_order: Some(parsed) },
        Err(e) => LoadOrderResult { success: false, error: Some(e), load_order: None },
    }
}

#[tauri::command]
pub fn load_order_write_to_settings(state: tauri::State<'_, AppState>) -> LoadOrderResult {
    let gp = state.game_path.lock().unwrap();
    let game_path = match &*gp {
        Some(p) => p.clone(),
        None => return LoadOrderResult { success: false, error: Some("游戏路径未设置".into()), load_order: None },
    };
    drop(gp);
    let order = load_load_order_file();
    match write_load_order_to_settings_save(&order, &game_path) {
        Ok(()) => LoadOrderResult { success: true, error: None, load_order: Some(order) },
        Err(e) => LoadOrderResult { success: false, error: Some(e), load_order: None },
    }
}

#[tauri::command]
pub fn load_order_get_enabled_ids(state: tauri::State<'_, AppState>) -> Vec<LoadOrderEntry> {
    let gp = state.game_path.lock().unwrap();
    let game_path = match &*gp {
        Some(p) => p.clone(),
        None => return vec![],
    };
    drop(gp);
    let all_mods = mods::full_mods_scan(&game_path);
    all_mods.iter().filter(|m| m.enabled).filter_map(|m| {
        m.id.clone().map(|id| LoadOrderEntry { id, enabled: m.enabled })
    }).collect()
}