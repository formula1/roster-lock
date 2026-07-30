use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

use tokio;
use tokio::io::{AsyncReadExt, AsyncSeekExt};


#[derive(Debug, Serialize, Deserialize)]
pub struct DirEntry {
  name: String,
  is_directory: bool,
  is_file: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileStat {
  size: u64,
  is_directory: bool,
  is_file: bool,
  mtime: String,
  ctime: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalkResult {
  path: String,
  relative_path: String,
  is_directory: bool,
  is_file: bool,
  size: u64,
}

#[tauri::command]
pub async fn fs_home_dir() -> Result<String, String> {
  dirs::home_dir()
    .map(|p| p.to_string_lossy().to_string())
    .ok_or_else(|| "Could not get home directory".to_string())
}

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<Vec<u8>, String> {
  fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_read_file_chunk(
    path: String, 
    offset: u64, 
    length: u64
) -> Result<Vec<u8>, String> {
    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|e| e.to_string())?;
    
    file.seek(tokio::io::SeekFrom::Start(offset))
        .await
        .map_err(|e| e.to_string())?;
    
    let mut buf = vec![0; length as usize];
    let n = file.read(&mut buf)
        .await
        .map_err(|e| e.to_string())?;
    
    buf.truncate(n);
    Ok(buf)
}

#[tauri::command]
pub async fn fs_write_file(path: String, data: Vec<u8>) -> Result<(), String> {
  fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_remove_file(path: String) -> Result<(), String> {
  fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_mkdir(path: String) -> Result<(), String> {
  fs::create_dir(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_mkdir_all(path: String) -> Result<(), String> {
  fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_exists(path: String) -> Result<bool, String> {
  Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn fs_get_home_dir() -> Result<String, String> {
  dirs::home_dir()
    .map(|p| p.to_string_lossy().to_string())
    .ok_or_else(|| "Could not get home directory".to_string())
}

#[tauri::command]
pub async fn fs_get_app_data_dir(app: AppHandle) -> Result<String, String> {
  app
    .path()
    .app_data_dir()
    .map(|p| p.to_string_lossy().to_string())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fs_get_documents_dir() -> Result<String, String> {
  dirs::document_dir()
    .map(|p| p.to_string_lossy().to_string())
    .ok_or_else(|| "Could not get documents directory".to_string())
}

#[tauri::command]
pub async fn fs_get_downloads_dir() -> Result<String, String> {
  dirs::download_dir()
    .map(|p| p.to_string_lossy().to_string())
    .ok_or_else(|| "Could not get downloads directory".to_string())
}

#[tauri::command]
pub async fn fs_get_match_lock_dir() -> Result<String, String> {
  let home = dirs::home_dir().ok_or_else(|| "Could not get home directory".to_string())?;
  Ok(home.join("roster-lock").to_string_lossy().to_string())
}

#[tauri::command]
pub async fn fs_read_dir(dir_path: String) -> Result<Vec<DirEntry>, String> {
  let entries = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;

  let mut result = Vec::new();
  for entry in entries {
    let entry = entry.map_err(|e| e.to_string())?;
    let metadata = entry.metadata().map_err(|e| e.to_string())?;

    result.push(DirEntry {
      name: entry.file_name().to_string_lossy().to_string(),
      is_directory: metadata.is_dir(),
      is_file: metadata.is_file(),
    });
  }

  Ok(result)
}

#[tauri::command]
pub async fn fs_stat(file_path: String) -> Result<FileStat, String> {
  let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;

  Ok(FileStat {
    size: metadata.len(),
    is_directory: metadata.is_dir(),
    is_file: metadata.is_file(),
    mtime: format!("{:?}", metadata.modified().map_err(|e| e.to_string())?),
    ctime: format!("{:?}", metadata.created().map_err(|e| e.to_string())?),
  })
}

#[tauri::command]
pub async fn fs_start_walk_stream(
  app: AppHandle,
  dir_path: String,
  stream_id: String,
) -> Result<(), String> {
  let dir_path_clone = dir_path.clone();
  let base_path = PathBuf::from(dir_path);

  tokio::spawn(async move {
    for entry in WalkDir::new(&dir_path_clone) {
      match entry {
        Ok(entry) => {
          if entry.file_type().is_file() {
            let path = entry.path();
            let relative_path = path
              .strip_prefix(&base_path)
              .unwrap_or(path)
              .to_string_lossy()
              .to_string();

            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

            let result = WalkResult {
              path: path.to_string_lossy().to_string(),
              relative_path,
              is_directory: false,
              is_file: true,
              size,
            };

            if let Err(e) = app.emit(&format!("fs-walk-stream-data-{}", stream_id), &result) {
              log::error!("Failed to emit walk stream data: {}", e);
              let _ = app.emit(
                &format!("fs-walk-stream-error-{}", stream_id),
                e.to_string(),
              );
              return;
            }
          }
        }
        Err(e) => {
          log::error!("Error walking directory: {}", e);
          let _ = app.emit(
            &format!("fs-walk-stream-error-{}", stream_id),
            e.to_string(),
          );
          return;
        }
      }
    }

    // Signal completion
    let _ = app.emit(&format!("fs-walk-stream-end-{}", stream_id), ());
  });

  Ok(())
}
