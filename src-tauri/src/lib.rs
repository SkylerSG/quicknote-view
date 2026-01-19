use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
struct Note {
    date: String,
    content: String,
}

#[derive(Serialize, Deserialize)]
struct AppConfig {
    file_path: String,
}

fn get_config_file_path() -> PathBuf {
    let home = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .expect("Could not find home directory");
    PathBuf::from(home).join(".quicknote_config.json")
}

#[tauri::command]
fn get_settings() -> Result<Option<String>, String> {
    let config_path = get_config_file_path();
    if config_path.exists() {
        let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
        let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(Some(config.file_path))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn save_settings(path: String) -> Result<(), String> {
    let config_path = get_config_file_path();
    let config = AppConfig { file_path: path };
    let content = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn read_notes(file_path: String) -> Result<Vec<Note>, String> {
    println!("Attempting to read notes from: {}", file_path);
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Error reading file at '{}': {}", file_path, e))?;
    
    let mut notes = Vec::new();
    let chunks: Vec<&str> = content.split("------------------").collect();

    for chunk in chunks {
        let trimmed = chunk.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(newline_idx) = trimmed.find('\n') {
            let date_line = &trimmed[..newline_idx].trim();
            let note_content = &trimmed[newline_idx + 1..].trim();
            let date = date_line.replace("[", "").replace("]", "");

            notes.push(Note {
                date: date,
                content: note_content.to_string(),
            });
        }
    }
    notes.reverse();

    Ok(notes)
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    tauri_plugin_opener::open_path(path, None::<&str>).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            read_notes,
            open_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
