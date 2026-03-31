use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message, WebSocketStream, MaybeTlsStream};
use tokio::net::TcpStream;

type WsStream = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub struct RelayClient {
    url: String,
    room_id: String,
    user_id: String,
    public_key: String,
    ws: Arc<Mutex<Option<WsStream>>>,
}

impl RelayClient {
    pub fn new(url: &str, room_id: &str, user_id: &str, public_key: &str) -> Self {
        Self {
            url: url.to_string(),
            room_id: room_id.to_string(),
            user_id: user_id.to_string(),
            public_key: public_key.to_string(),
            ws: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn connect(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let ws_url = format!(
            "{}/room/{}?userId={}&publicKey={}",
            self.url.replace("http", "ws"),
            self.room_id,
            self.user_id,
            self.public_key
        );

        let (ws_stream, _) = connect_async(&ws_url).await?;
        *self.ws.lock().await = Some(ws_stream);

        Ok(())
    }

    pub async fn send_message(&self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut ws = self.ws.lock().await;
        
        if let Some(stream) = ws.as_mut() {
            stream.send(Message::Text(message.to_string())).await?;
            Ok(())
        } else {
            Err("Not connected".into())
        }
    }

    pub async fn receive_message(&self) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let mut ws = self.ws.lock().await;
        
        if let Some(stream) = ws.as_mut() {
            if let Some(msg) = stream.next().await {
                match msg? {
                    Message::Text(text) => Ok(Some(text)),
                    Message::Binary(data) => Ok(Some(String::from_utf8_lossy(&data).to_string())),
                    _ => Ok(None),
                }
            } else {
                Ok(None)
            }
        } else {
            Err("Not connected".into())
        }
    }

    pub async fn broadcast(&self, event: &str, data: Value) -> Result<(), Box<dyn std::error::Error>> {
        let message = serde_json::json!({
            "type": "broadcast",
            "event": event,
            "data": data,
        });
        
        self.send_message(&message.to_string()).await
    }
}

