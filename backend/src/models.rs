use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub display_name: String,
    pub bio: String,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
pub struct UserCredentials {
    pub id: Uuid,
    pub password_hash: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub user_agent: String,
    pub ip_address: String,
    pub created_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub visibility: String,
    pub default_branch: String,
    pub language: String,
    pub archived: bool,
    pub owner_username: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct ActivityEvent {
    pub id: i64,
    pub kind: String,
    pub summary: String,
    pub repository_name: Option<String>,
    pub actor: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub username: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRepositoryRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: Option<String>,
    pub default_branch: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRepositoryRequest {
    pub description: Option<String>,
    pub visibility: Option<String>,
    pub default_branch: Option<String>,
    pub language: Option<String>,
    pub archived: Option<bool>,
}
