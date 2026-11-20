use std::time::Duration;

use keyring::{Entry, Error};
use reqwest::{redirect::Policy, Client, Response, StatusCode};
use serde::{Deserialize, Serialize};

const KEYRING_ERROR: &str = "無法存取系統憑證，請確認憑證服務可用。";
const NETWORK_ERROR: &str = "無法連線至 DeepSeek，請確認網路後再試。";
const CHARACTER_PROMPT: &str = concat!(
    include_str!("../../skills/amamiya-shizuku/SKILL.md"),
    "\n\n## 共用角色資料\n",
    include_str!("../../src/characterProfile.json"),
);

fn credential() -> Result<Entry, String> {
    Entry::new("dev.elise.pet", "deepseek-api-key").map_err(|_| KEYRING_ERROR.into())
}

#[tauri::command]
pub fn deepseek_has_key() -> Result<bool, String> {
    match credential()?.get_password() {
        Ok(_) => Ok(true),
        Err(Error::NoEntry) => Ok(false),
        Err(_) => Err(KEYRING_ERROR.into()),
    }
}

#[tauri::command]
pub fn deepseek_save_key(key: String) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() || key.len() > 512 || !key.bytes().all(|byte| byte.is_ascii_graphic()) {
        return Err("請輸入有效的 API Key，勿包含空格。".into());
    }
    credential()?
        .set_password(key)
        .map_err(|_| KEYRING_ERROR.into())
}

#[tauri::command]
pub fn deepseek_remove_key() -> Result<(), String> {
    match credential()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err(KEYRING_ERROR.into()),
    }
}

#[derive(Deserialize, Serialize)]
pub struct Balance {
    is_available: bool,
    balance_infos: Vec<BalanceInfo>,
}

#[derive(Deserialize, Serialize)]
struct BalanceInfo {
    currency: String,
    total_balance: String,
    granted_balance: String,
    topped_up_balance: String,
}

async fn stored_key() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        credential()?.get_password().map_err(|error| match error {
            Error::NoEntry => "請先儲存 DeepSeek API Key。".into(),
            _ => KEYRING_ERROR.to_owned(),
        })
    })
    .await
    .map_err(|_| KEYRING_ERROR.to_owned())?
}

fn client(timeout: Duration) -> Result<Client, String> {
    Client::builder()
        .https_only(true)
        .redirect(Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(timeout)
        .build()
        .map_err(|_| "無法初始化 DeepSeek 連線。".into())
}

fn check_status(response: Response) -> Result<Response, String> {
    match response.status() {
        status if status.is_success() => Ok(response),
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            Err("DeepSeek 拒絕了這組 API Key，請確認後重新儲存。".into())
        }
        StatusCode::PAYMENT_REQUIRED => Err("DeepSeek API 餘額不足，請查看帳戶餘額。".into()),
        StatusCode::TOO_MANY_REQUESTS => Err("請求太頻繁，請稍後再試。".into()),
        status => Err(format!(
            "DeepSeek 目前無法處理請求（HTTP {}）。",
            status.as_u16()
        )),
    }
}

#[tauri::command]
pub async fn deepseek_balance() -> Result<Balance, String> {
    let key = stored_key().await?;
    let response = client(Duration::from_secs(15))?
        .get("https://api.deepseek.com/user/balance")
        .bearer_auth(key)
        .send()
        .await
        .map_err(|_| NETWORK_ERROR)?;
    check_status(response)?
        .json()
        .await
        .map_err(|_| "無法讀取 DeepSeek 的餘額資料。".into())
}

#[derive(Deserialize, Serialize)]
pub enum Model {
    #[serde(rename = "deepseek-flash")]
    Flash,
    #[serde(rename = "deepseek-v4-pro")]
    Pro,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Effort {
    Low,
    High,
    Max,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
enum Role {
    #[serde(skip_deserializing)]
    System,
    User,
    Assistant,
}

#[derive(Deserialize, Serialize)]
pub struct ChatMessage {
    role: Role,
    content: String,
}

#[derive(Serialize)]
struct Thinking {
    #[serde(rename = "type")]
    mode: &'static str,
}

#[derive(Serialize)]
struct ChatRequest {
    model: Model,
    messages: Vec<ChatMessage>,
    thinking: Thinking,
    #[serde(skip_serializing_if = "Option::is_none")]
    reasoning_effort: Option<Effort>,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct Completion {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: Reply,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct Reply {
    content: Option<String>,
}

#[tauri::command]
pub async fn deepseek_chat(
    model: Model,
    thinking: bool,
    effort: Effort,
    mut messages: Vec<ChatMessage>,
) -> Result<String, String> {
    if messages.len() > 25
        || !matches!(messages.last(), Some(message) if matches!(message.role, Role::User) && !message.content.trim().is_empty())
    {
        return Err("請輸入要傳送的訊息。".into());
    }

    let key = stored_key().await?;
    messages.insert(
        0,
        ChatMessage {
            role: Role::System,
            content: CHARACTER_PROMPT.into(),
        },
    );
    let request = ChatRequest {
        model,
        messages,
        thinking: Thinking {
            mode: if thinking { "enabled" } else { "disabled" },
        },
        reasoning_effort: thinking.then_some(effort),
        max_tokens: if thinking { 8192 } else { 2048 },
    };
    let response = client(Duration::from_secs(120))?
        .post("https://api.deepseek.com/chat/completions")
        .bearer_auth(key)
        .json(&request)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "DeepSeek 回覆逾時，請稍後再試。"
            } else {
                NETWORK_ERROR
            }
        })?;
    let completion: Completion = check_status(response)?.json().await.map_err(|error| {
        if error.is_timeout() {
            "DeepSeek 回覆逾時，請稍後再試。"
        } else {
            "無法讀取 DeepSeek 回覆。"
        }
    })?;
    let choice = completion.choices.into_iter().next();
    if let Some(choice) = choice {
        if let Some(text) = choice
            .message
            .content
            .filter(|text| !text.trim().is_empty())
        {
            return Ok(text);
        }
        if choice.finish_reason.as_deref() == Some("length") {
            return Err("回覆已達長度上限，請縮短問題或降低思考力度後再試。".into());
        }
    }
    Err("DeepSeek 沒有回傳可顯示的回覆。".into())
}
