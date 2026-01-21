use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Debug)]
pub struct MatchStatus {
    pub status: String,
    #[serde(rename = "roomId")]
    pub room_id: Option<String>,
    pub url: Option<String>,
}

pub struct MatchmakingClient {
    base_url: String,
    client: reqwest::Client,
}

impl MatchmakingClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub async fn join_queue(
        &mut self,
        user_id: &str,
        display_name: &str,
        roster_config: Value,
        public_key: &str,
        signature: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let body = serde_json::json!({
            "userId": user_id,
            "displayName": display_name,
            "rosterConfig": roster_config,
            "publicKey": public_key,
            "signature": signature,
        });

        let response = self
            .client
            .post(format!("{}/join", self.base_url))
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Failed to join queue: {}", error_text).into());
        }

        Ok(())
    }

    pub async fn check_status(
        &self,
        roster_hash: &str,
        public_key: &str,
        signature: &str,
    ) -> Result<MatchStatus, Box<dyn std::error::Error>> {
        let url = format!(
            "{}/status/{}?publicKey={}&signature={}",
            self.base_url, roster_hash, public_key, signature
        );

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Failed to check status: {}", error_text).into());
        }

        let status: MatchStatus = response.json().await?;
        Ok(status)
    }

    pub async fn leave_queue(
        &self,
        roster_hash: &str,
        public_key: &str,
        signature: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let body = serde_json::json!({
            "rosterConfigHash": roster_hash,
            "publicKey": public_key,
            "signature": signature,
        });

        let response = self
            .client
            .post(format!("{}/leave", self.base_url))
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Failed to leave queue: {}", error_text).into());
        }

        Ok(())
    }
}

