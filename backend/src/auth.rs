use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Duration, Utc};
use rand::RngCore;
use serde_json::json;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    error::{ApiError, ApiResult},
    models::*,
    AppState,
};

const SESSION_LIFETIME_HOURS: i64 = 24 * 7;
const MAX_FAILED_ATTEMPTS: i64 = 8;
const ATTEMPT_WINDOW_MINUTES: i64 = 15;

pub fn hash_password(password: &str) -> ApiResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| ApiError::Internal("Password hashing failed".into()))
}

fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|parsed| {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .is_ok()
        })
        .unwrap_or(false)
}

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::to_owned)
}

fn client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn user_agent(headers: &HeaderMap) -> String {
    headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .chars()
        .take(200)
        .collect()
}

fn validate_email(email: &str) -> ApiResult<String> {
    let email = email.trim().to_lowercase();
    let valid = email.len() >= 5
        && email.matches('@').count() == 1
        && email.split('@').nth(1).is_some_and(|d| d.contains('.'));
    if !valid {
        return Err(ApiError::BadRequest("Enter a valid email address".into()));
    }
    Ok(email)
}

fn validate_username(username: &str) -> ApiResult<String> {
    let username = username.trim().to_lowercase();
    let valid = (3..=32).contains(&username.len())
        && username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        && username.chars().next().is_some_and(|c| c.is_ascii_alphanumeric());
    if !valid {
        return Err(ApiError::BadRequest(
            "Username must be 3-32 characters: letters, numbers, - or _".into(),
        ));
    }
    Ok(username)
}

fn validate_password(password: &str) -> ApiResult<()> {
    if password.len() < 8 {
        return Err(ApiError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }
    if !password.chars().any(|c| c.is_ascii_digit()) || !password.chars().any(|c| c.is_alphabetic())
    {
        return Err(ApiError::BadRequest(
            "Password must contain both letters and numbers".into(),
        ));
    }
    Ok(())
}

async fn issue_session(
    state: &AppState,
    user_id: Uuid,
    headers: &HeaderMap,
) -> ApiResult<(String, DateTime<Utc>)> {
    let token = generate_token();
    let expires_at = Utc::now() + Duration::hours(SESSION_LIFETIME_HOURS);

    sqlx::query(
        "INSERT INTO sessions (user_id, token_hash, user_agent, ip_address, expires_at) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(user_id)
    .bind(hash_token(&token))
    .bind(user_agent(headers))
    .bind(client_ip(headers))
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    Ok((token, expires_at))
}

pub async fn current_user(state: &AppState, headers: &HeaderMap) -> ApiResult<User> {
    let token = bearer_token(headers)
        .ok_or_else(|| ApiError::Unauthorized("Sign in to continue".into()))?;

    let user = sqlx::query_as::<_, User>(
        "SELECT u.id, u.email, u.username, u.display_name, u.bio, u.avatar_url, u.created_at \
         FROM sessions s JOIN users u ON u.id = s.user_id \
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()",
    )
    .bind(hash_token(&token))
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::Unauthorized("Session expired, sign in again".into()))?;

    sqlx::query("UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1")
        .bind(hash_token(&token))
        .execute(&state.db)
        .await?;

    Ok(user)
}

pub async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> ApiResult<(StatusCode, Json<AuthResponse>)> {
    let email = validate_email(&payload.email)?;
    let username = validate_username(&payload.username)?;
    validate_password(&payload.password)?;

    let display_name = payload
        .display_name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| username.clone());

    let password_hash = hash_password(&payload.password)?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, username, password_hash, display_name) \
         VALUES ($1, $2, $3, $4) \
         RETURNING id, email, username, display_name, bio, avatar_url, created_at",
    )
    .bind(&email)
    .bind(&username)
    .bind(&password_hash)
    .bind(&display_name)
    .fetch_one(&state.db)
    .await
    .map_err(|err| match err {
        sqlx::Error::Database(e) if e.is_unique_violation() => {
            ApiError::Conflict("Email or username is already taken".into())
        }
        other => ApiError::from(other),
    })?;

    let (token, expires_at) = issue_session(&state, user.id, &headers).await?;

    sqlx::query("INSERT INTO activity_events (user_id, kind, summary) VALUES ($1, $2, $3)")
        .bind(user.id)
        .bind("account.created")
        .bind(format!("{} joined GitOp", user.username))
        .execute(&state.db)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            user,
            token,
            expires_at,
        }),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> ApiResult<Json<AuthResponse>> {
    let email = payload.email.trim().to_lowercase();
    let ip = client_ip(&headers);

    let failed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM login_attempts \
         WHERE LOWER(email) = $1 AND successful = FALSE \
           AND created_at > NOW() - ($2 || ' minutes')::interval",
    )
    .bind(&email)
    .bind(ATTEMPT_WINDOW_MINUTES.to_string())
    .fetch_one(&state.db)
    .await?;

    if failed >= MAX_FAILED_ATTEMPTS {
        return Err(ApiError::TooManyRequests(
            "Too many failed attempts. Try again in 15 minutes".into(),
        ));
    }

    let record = sqlx::query_as::<_, UserCredentials>(
        "SELECT id, password_hash FROM users WHERE LOWER(email) = $1",
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await?;

    let authenticated = record
        .as_ref()
        .is_some_and(|r| verify_password(&payload.password, &r.password_hash));

    sqlx::query("INSERT INTO login_attempts (email, ip_address, successful) VALUES ($1, $2, $3)")
        .bind(&email)
        .bind(&ip)
        .bind(authenticated)
        .execute(&state.db)
        .await?;

    let Some(record) = record.filter(|_| authenticated) else {
        return Err(ApiError::Unauthorized("Incorrect email or password".into()));
    };

    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, username, display_name, bio, avatar_url, created_at \
         FROM users WHERE id = $1",
    )
    .bind(record.id)
    .fetch_one(&state.db)
    .await?;

    let (token, expires_at) = issue_session(&state, user.id, &headers).await?;

    Ok(Json(AuthResponse {
        user,
        token,
        expires_at,
    }))
}

pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<StatusCode> {
    let Some(token) = bearer_token(&headers) else {
        return Ok(StatusCode::NO_CONTENT);
    };

    sqlx::query("UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL")
        .bind(hash_token(&token))
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn me(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<User>> {
    Ok(Json(current_user(&state, &headers).await?))
}

pub async fn update_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateProfileRequest>,
) -> ApiResult<Json<User>> {
    let user = current_user(&state, &headers).await?;

    let display_name = payload
        .display_name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or(user.display_name);
    let bio = payload.bio.unwrap_or(user.bio);
    let avatar_url = payload.avatar_url.or(user.avatar_url);

    let updated = sqlx::query_as::<_, User>(
        "UPDATE users SET display_name = $2, bio = $3, avatar_url = $4, updated_at = NOW() \
         WHERE id = $1 \
         RETURNING id, email, username, display_name, bio, avatar_url, created_at",
    )
    .bind(user.id)
    .bind(display_name)
    .bind(bio)
    .bind(avatar_url)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated))
}

pub async fn change_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    let user = current_user(&state, &headers).await?;
    validate_password(&payload.new_password)?;

    let current_hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;

    if !verify_password(&payload.current_password, &current_hash) {
        return Err(ApiError::Unauthorized("Current password is incorrect".into()));
    }

    let new_hash = hash_password(&payload.new_password)?;

    sqlx::query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
        .bind(user.id)
        .bind(new_hash)
        .execute(&state.db)
        .await?;

    // Every other session is invalidated; the caller keeps working with its token.
    let token_hash = bearer_token(&headers).map(|t| hash_token(&t)).unwrap_or_default();
    sqlx::query(
        "UPDATE sessions SET revoked_at = NOW() \
         WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL",
    )
    .bind(user.id)
    .bind(token_hash)
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "status": "password_updated" })))
}

pub async fn list_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<Session>>> {
    let user = current_user(&state, &headers).await?;

    let sessions = sqlx::query_as::<_, Session>(
        "SELECT id, user_agent, ip_address, created_at, last_seen_at, expires_at \
         FROM sessions \
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW() \
         ORDER BY last_seen_at DESC",
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(sessions))
}

pub async fn revoke_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
) -> ApiResult<StatusCode> {
    let user = current_user(&state, &headers).await?;

    let result = sqlx::query(
        "UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
    )
    .bind(session_id)
    .bind(user.id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound("Session not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}
