// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

mod matchmaking;
mod relay;
mod webrtc;

use matchmaking::MatchmakingClient;
use relay::RelayClient;

#[derive(Default)]
struct AppState {
    matchmaking: Arc<Mutex<Option<MatchmakingClient>>>,
    relay: Arc<Mutex<Option<RelayClient>>>,
}

#[derive(Serialize, Deserialize)]
struct JoinQueueRequest {
    user_id: String,
    display_name: String,
    roster_config: serde_json::Value,
    public_key: String,
    signature: String,
}

#[derive(Serialize, Deserialize)]
struct MatchStatus {
    status: String,
    room_id: Option<String>,
    url: Option<String>,
}

#[tauri::command]
async fn join_matchmaking_queue(
    request: JoinQueueRequest,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut client = MatchmakingClient::new("http://localhost:3001");
    
    client
        .join_queue(
            &request.user_id,
            &request.display_name,
            request.roster_config,
            &request.public_key,
            &request.signature,
        )
        .await
        .map_err(|e| e.to_string())?;
    
    *state.matchmaking.lock().await = Some(client);
    Ok("Joined queue".to_string())
}

#[tauri::command]
async fn check_match_status(
    roster_hash: String,
    public_key: String,
    signature: String,
    state: State<'_, AppState>,
) -> Result<MatchStatus, String> {
    let matchmaking = state.matchmaking.lock().await;
    
    if let Some(client) = matchmaking.as_ref() {
        let status = client
            .check_status(&roster_hash, &public_key, &signature)
            .await
            .map_err(|e| e.to_string())?;
        
        Ok(status)
    } else {
        Err("Not in queue".to_string())
    }
}

#[tauri::command]
async fn connect_to_relay(
    room_id: String,
    url: String,
    user_id: String,
    public_key: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut relay_client = RelayClient::new(&url, &room_id, &user_id, &public_key);
    
    relay_client.connect().await.map_err(|e| e.to_string())?;
    
    *state.relay.lock().await = Some(relay_client);
    Ok("Connected to relay".to_string())
}

#[tauri::command]
async fn send_game_message(
    message: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let relay = state.relay.lock().await;
    
    if let Some(client) = relay.as_ref() {
        client.send_message(&message).await.map_err(|e| e.to_string())
    } else {
        Err("Not connected to relay".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            join_matchmaking_queue,
            check_match_status,
            connect_to_relay,
            send_game_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

