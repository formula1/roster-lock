
use dirs;
use std::path::PathBuf;
use super::filename::{raw_key_to_filename, raw_filename_to_key};

fn ensure_storage_dir() -> Result<PathBuf, String> {
  let home = dirs::home_dir()
    .ok_or("Could not determine home directory")?;

  let storage_dir = home.join(".matchlock-prep-app").join("storage");

  if !storage_dir.exists() {
    std::fs::create_dir_all(&storage_dir)
      .map_err(|e| format!("Failed to create storage directory: {}", e))?;
  }

  Ok(storage_dir)
}


const PREFIX: &str = "store-";
const EXTENSION: &str = ".json";

fn key_to_filename(key: &str) -> Result<String, String> {
  let escaped_key = raw_key_to_filename(key)?;
  Ok(format!("{}{}{}", PREFIX, escaped_key, EXTENSION))
}

fn is_filename_valid(filename: &str) -> bool {
  filename.starts_with(PREFIX) && filename.ends_with(EXTENSION)
}

fn filename_to_key(filename: &str) -> Result<String, String> {
  if !is_filename_valid(filename) {
    return Err("Invalid filename format".to_string());
  }

  let name = &filename[PREFIX.len()..filename.len() - EXTENSION.len()]; // remove prefix and ".json"
  raw_filename_to_key(name)
}

fn raw_key_to_filepath(key: &str) -> Result<PathBuf, String> {
  let dir = ensure_storage_dir()?;
  let filename = key_to_filename(key)?;
  Ok(dir.join(filename))
}


// Crud Operations
#[tauri::command]
pub fn native_storage_set(key: &str, value: serde_json::Value) -> Result<(), String> {
  let filepath = raw_key_to_filepath(key)?;

  let json_string = serde_json::to_string_pretty(&value)
    .map_err(|e| format!("Failed to serialize value: {}", e))?;

  std::fs::write(&filepath, json_string)
    .map_err(|e| format!("Failed to write file: {}", e))?;
  Ok(())
}

#[tauri::command]
pub fn native_storage_get(key: &str) -> Result<Option<serde_json::Value>, String> {
  let filepath = raw_key_to_filepath(key)?;

  if !std::path::Path::new(&filepath).exists() {
    return Ok(None);
  }

  let content = std::fs::read_to_string(&filepath)
    .map_err(|e| format!("Failed to read file: {}", e))?;

  let value: serde_json::Value = serde_json::from_str(&content)
    .map_err(|e| format!("Failed to parse JSON: {}", e))?;

  Ok(Some(value))
}

#[tauri::command]
pub fn native_storage_remove(key: &str) -> Result<(), String> {
  let filepath = raw_key_to_filepath(key)?;

  if !std::path::Path::new(&filepath).exists() {
    return Ok(());
  }

  std::fs::remove_file(&filepath)
    .map_err(|e| format!("Failed to remove file: {}", e))?;
  Ok(())
}

#[tauri::command]
pub fn native_storage_keys() -> Result<Vec<String>, String> {
  let dir = ensure_storage_dir()?;
  let entries = std::fs::read_dir(&dir).map_err(|e| format!("Failed to read dir: {}", e))?;

  let mut keys = Vec::new();
  for entry in entries {
    let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
    let filename = entry.file_name().to_string_lossy().to_string();
    if is_filename_valid(&filename) {
      keys.push(filename_to_key(&filename)?);
    }
  }

  Ok(keys)
}

#[tauri::command]
pub fn native_storage_clear() -> Result<(), String> {
  let dir = ensure_storage_dir()?;
  let entries = std::fs::read_dir(&dir).map_err(|e| format!("Failed to read dir: {}", e))?;

  for entry in entries {
    let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
    let filename = entry.file_name().to_string_lossy().to_string();
    if is_filename_valid(&filename) {
      let filepath = dir.join(&filename);
      std::fs::remove_file(&filepath).map_err(|e| format!("Failed to remove file: {}", e))?;
    }
  }

  Ok(())
}
