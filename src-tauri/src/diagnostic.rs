use crate::config;
use crate::steam;
use chrono::Local;
use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
pub struct ExportResult {
    pub success: bool,
    pub error: Option<String>,
}

/// Build the directory tree string for a given path
fn build_directory_tree(path: &Path, prefix: &str, is_root: bool) -> String {
    let mut result = String::new();

    if is_root {
        result.push_str(&format!("{}\n", path.to_string_lossy()));
    }

    if !path.exists() {
        if is_root {
            result.push_str("  (目录不存在)\n");
        }
        return result;
    }

    let mut entries: Vec<_> = match fs::read_dir(path) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                // Skip hidden files
                !name.starts_with('.')
            })
            .collect(),
        Err(_) => return result,
    };

    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if a_is_dir != b_is_dir {
            return if a_is_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }
        a.file_name().cmp(&b.file_name())
    });

    for (i, entry) in entries.iter().enumerate() {
        let is_last = i == entries.len() - 1;
        let connector = if is_last { "└── " } else { "├── " };
        let new_prefix = if is_last { "    " } else { "│   " };

        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

        if is_dir {
            result.push_str(&format!("{}{}{}/\n", prefix, connector, name));
            let full_path = entry.path();
            result.push_str(&build_directory_tree(&full_path, &format!("{}{}", prefix, new_prefix), false));
        } else {
            let meta = entry.metadata().ok();
            let size = meta.map(|m| m.len()).unwrap_or(0);
            let size_str = if size < 1024 {
                format!("{} B", size)
            } else if size < 1024 * 1024 {
                format!("{:.1} KB", size as f64 / 1024.0)
            } else {
                format!("{:.1} MB", size as f64 / (1024.0 * 1024.0))
            };
            result.push_str(&format!("{}{}{}  ({})\n", prefix, connector, name, size_str));
        }
    }

    result
}

/// Read a file safely, returning its content or an error message
fn read_file_safe(path: &Path) -> String {
    if !path.exists() {
        return "(文件不存在)".to_string();
    }
    match fs::read_to_string(path) {
        Ok(content) => content,
        Err(e) => format!("(读取失败: {})", e),
    }
}

/// Get system environment info
fn get_system_info() -> String {
    let mut info = String::new();
    info.push_str(&format!("操作系统: {}\n", std::env::consts::OS));
    info.push_str(&format!("架构: {}\n", std::env::consts::ARCH));
    info.push_str(&format!("报告生成时间: {}\n", Local::now().format("%Y-%m-%d %H:%M:%S")));

    // Environment variables
    let useful_vars = ["USERNAME", "USER", "HOSTNAME"];
    for var in &useful_vars {
        if let Ok(val) = std::env::var(var) {
            info.push_str(&format!("{}: {}\n", var, val));
        }
    }

    info
}

/// Get the last N lines from a file
fn get_tail(path: &Path, max_lines: usize) -> String {
    let content = read_file_safe(path);
    if content.starts_with('(') {
        return content;
    }
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= max_lines {
        content
    } else {
        let tail: Vec<&str> = lines[lines.len().saturating_sub(max_lines)..].to_vec();
        format!(
            "(显示最后 {} 行，共 {} 行)\n\n{}",
            max_lines,
            lines.len(),
            tail.join("\n")
        )
    }
}

/// Generate the diagnostic report content
fn generate_report(state: &crate::AppState) -> String {
    let mut report = String::new();

    // ── 1. System Environment ──
    let divider = "=".repeat(80);
    report.push_str(&format!(
        "{}\n一、系统环境信息\n{}\n\n",
        divider, divider
    ));
    report.push_str(&get_system_info());
    report.push('\n');

    // ── 2. Config / settings.save ──
    report.push_str(&format!(
        "{}\n二、settings.save 内容\n{}\n\n",
        divider, divider
    ));

    // Find the steam settings file path
    let cfg = config::load_config();
    if let Some(ref steam_id) = cfg.steam_id {
        if let Some(base) = dirs::config_dir() {
            let settings_path = base
                .join("SlayTheSpire2")
                .join("steam")
                .join(steam_id)
                .join("settings.save");
            report.push_str(&format!("路径: {}\n\n", settings_path.to_string_lossy()));
            report.push_str(&read_file_safe(&settings_path));
        } else {
            report.push_str("无法获取应用数据目录\n");
        }
    } else {
        report.push_str("未设置 Steam 用户 ID\n");
    }
    report.push('\n');

    // ── 3. Mods folder directory tree ──
    report.push_str(&format!(
        "{}\n三、Mods 文件夹目录树\n{}\n\n",
        divider, divider
    ));
    let game_path = state.game_path.lock().unwrap().clone();
    if let Some(ref gp) = game_path {
        let mods_dir = Path::new(gp).join("mods");
        report.push_str(&build_directory_tree(&mods_dir, "", true));
    } else {
        report.push_str("未设置游戏路径\n");
    }
    report.push('\n');

    // ── 4. mods_disabled folder directory tree ──
    report.push_str(&format!(
        "{}\n四、mods_disabled 文件夹目录树\n{}\n\n",
        divider, divider
    ));
    let game_path = state.game_path.lock().unwrap().clone();
    if let Some(ref gp) = game_path {
        let disabled_dir = Path::new(gp).join("mods_disabled");
        report.push_str(&build_directory_tree(&disabled_dir, "", true));
    } else {
        report.push_str("未设置游戏路径\n");
    }
    report.push('\n');

    // ── 5. Workshop folder directory tree ──
    report.push_str(&format!(
        "{}\n五、创意工坊文件夹目录树\n{}\n\n",
        divider, divider
    ));
    if let Some(ref gp) = game_path {
        if let Some(wp) = steam::find_workshop_path(gp) {
            let workshop_dir = Path::new(&wp);
            report.push_str(&build_directory_tree(workshop_dir, "", true));
        } else {
            report.push_str("无法确定创意工坊路径\n");
        }
    } else {
        report.push_str("未设置游戏路径\n");
    }
    report.push('\n');

    // ── 6. Recent game logs ──
    report.push_str(&format!(
        "{}\n六、最近的游戏日志（最后 200 行）\n{}\n\n",
        divider, divider
    ));
    if let Some(base) = dirs::config_dir() {
        let logs_dir = base.join("SlayTheSpire2").join("logs");
        if logs_dir.exists() {
            // Find the most recent log file
            let mut log_files: Vec<(std::path::PathBuf, u64)> = Vec::new();
            if let Ok(entries) = fs::read_dir(&logs_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "log").unwrap_or(false) {
                        if let Ok(meta) = entry.metadata() {
                            if let Ok(mtime) = meta.modified() {
                                if let Ok(dur) = mtime.duration_since(std::time::UNIX_EPOCH) {
                                    log_files.push((path, dur.as_millis() as u64));
                                }
                            }
                        }
                    }
                }
            }
            log_files.sort_by(|a, b| b.1.cmp(&a.1));

            if let Some((latest_path, _)) = log_files.first() {
                report.push_str(&format!("日志文件: {}\n\n", latest_path.to_string_lossy()));
                report.push_str(&get_tail(latest_path, 200));
            } else {
                report.push_str("未找到日志文件\n");
            }
        } else {
            report.push_str("日志目录不存在\n");
        }
    } else {
        report.push_str("无法获取应用数据目录\n");
    }
    report.push('\n');

    report.push_str(&format!(
        "{}\n报告结束\n{}\n", divider, divider
    ));

    report
}

#[tauri::command]
pub async fn export_diagnostic_report(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<ExportResult, String> {
    // Generate the report content first
    let content = generate_report(&state);

    // Show save dialog
    let default_name = format!("sts2-diagnostic-{}.txt", Local::now().format("%Y-%m-%d"));
    let save_path = app
        .dialog()
        .file()
        .add_filter("文本文件 (*.txt)", &["txt"])
        .set_file_name(&default_name)
        .set_title("导出检测文件")
        .blocking_save_file();

    match save_path {
        Some(path) => {
            let p = path.to_string();
            match fs::write(&p, &content) {
                Ok(_) => Ok(ExportResult {
                    success: true,
                    error: None,
                }),
                Err(e) => Err(format!("写入文件失败: {}", e)),
            }
        }
        None => Ok(ExportResult {
            success: false,
            error: Some("用户取消了选择".to_string()),
        }),
    }
}