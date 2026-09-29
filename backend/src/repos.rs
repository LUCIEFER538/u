use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use serde_json::json;

use crate::{
    auth::current_user,
    error::{ApiError, ApiResult},
    models::*,
    AppState,
};

const REPO_COLUMNS: &str = "r.id, r.name, r.description, r.visibility, r.default_branch, \
                            r.language, r.archived, u.username AS owner_username, \
                            r.created_at, r.updated_at";

fn validate_repo_name(name: &str) -> ApiResult<String> {
    let name = name.trim().to_string();
    let valid = (1..=64).contains(&name.len())
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        && name.chars().next().is_some_and(|c| c.is_ascii_alphanumeric());
    if !valid {
        return Err(ApiError::BadRequest(
            "Repository name may contain letters, numbers, . - and _ only".into(),
        ));
    }
    Ok(name)
}

fn validate_visibility(visibility: &str) -> ApiResult<String> {
    match visibility {
        "public" | "private" => Ok(visibility.to_string()),
        _ => Err(ApiError::BadRequest(
            "Visibility must be 'public' or 'private'".into(),
        )),
    }
}

pub async fn list_repositories(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Vec<Repository>>> {
    let user = current_user(&state, &headers).await?;

    let repos = sqlx::query_as::<_, Repository>(&format!(
        "SELECT {REPO_COLUMNS} FROM repositories r JOIN users u ON u.id = r.owner_id \
         WHERE r.owner_id = $1 OR r.visibility = 'public' \
         ORDER BY r.updated_at DESC"
    ))
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(repos))
}

pub async fn create_repository(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateRepositoryRequest>,
) -> ApiResult<(StatusCode, Json<Repository>)> {
    let user = current_user(&state, &headers).await?;
    let name = validate_repo_name(&payload.name)?;
    let visibility = validate_visibility(payload.visibility.as_deref().unwrap_or("private"))?;
    let default_branch = payload
        .default_branch
        .map(|b| b.trim().to_string())
        .filter(|b| !b.is_empty())
        .unwrap_or_else(|| "main".to_string());

    let repo = sqlx::query_as::<_, Repository>(&format!(
        "WITH inserted AS ( \
            INSERT INTO repositories (owner_id, name, description, visibility, default_branch, language) \
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING * \
         ) SELECT {REPO_COLUMNS} FROM inserted r JOIN users u ON u.id = r.owner_id"
    ))
    .bind(user.id)
    .bind(&name)
    .bind(payload.description.unwrap_or_default())
    .bind(&visibility)
    .bind(&default_branch)
    .bind(payload.language.unwrap_or_default())
    .fetch_one(&state.db)
    .await
    .map_err(|err| match err {
        sqlx::Error::Database(e) if e.is_unique_violation() => {
            ApiError::Conflict("You already have a repository with that name".into())
        }
        other => ApiError::from(other),
    })?;

    sqlx::query(
        "INSERT INTO activity_events (user_id, repository_id, kind, summary) VALUES ($1, $2, $3, $4)",
    )
    .bind(user.id)
    .bind(repo.id)
    .bind("repository.created")
    .bind(format!("Created repository {}/{}", user.username, repo.name))
    .execute(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(repo)))
}

async fn find_repository(
    state: &AppState,
    viewer: &User,
    owner: &str,
    name: &str,
) -> ApiResult<Repository> {
    sqlx::query_as::<_, Repository>(&format!(
        "SELECT {REPO_COLUMNS} FROM repositories r JOIN users u ON u.id = r.owner_id \
         WHERE LOWER(u.username) = LOWER($1) AND LOWER(r.name) = LOWER($2) \
           AND (r.visibility = 'public' OR r.owner_id = $3)"
    ))
    .bind(owner)
    .bind(name)
    .bind(viewer.id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("Repository not found".into()))
}

pub async fn get_repository(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((owner, name)): Path<(String, String)>,
) -> ApiResult<Json<Repository>> {
    let user = current_user(&state, &headers).await?;
    Ok(Json(find_repository(&state, &user, &owner, &name).await?))
}

pub async fn update_repository(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((owner, name)): Path<(String, String)>,
    Json(payload): Json<UpdateRepositoryRequest>,
) -> ApiResult<Json<Repository>> {
    let user = current_user(&state, &headers).await?;
    let repo = find_repository(&state, &user, &owner, &name).await?;

    if !owner.eq_ignore_ascii_case(&user.username) {
        return Err(ApiError::Unauthorized(
            "Only the owner can change this repository".into(),
        ));
    }

    let visibility = match payload.visibility {
        Some(v) => validate_visibility(&v)?,
        None => repo.visibility,
    };

    let updated = sqlx::query_as::<_, Repository>(&format!(
        "WITH updated AS ( \
            UPDATE repositories SET description = $2, visibility = $3, default_branch = $4, \
                   language = $5, archived = $6, updated_at = NOW() \
            WHERE id = $1 RETURNING * \
         ) SELECT {REPO_COLUMNS} FROM updated r JOIN users u ON u.id = r.owner_id"
    ))
    .bind(repo.id)
    .bind(payload.description.unwrap_or(repo.description))
    .bind(visibility)
    .bind(payload.default_branch.unwrap_or(repo.default_branch))
    .bind(payload.language.unwrap_or(repo.language))
    .bind(payload.archived.unwrap_or(repo.archived))
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        "INSERT INTO activity_events (user_id, repository_id, kind, summary) VALUES ($1, $2, $3, $4)",
    )
    .bind(user.id)
    .bind(updated.id)
    .bind("repository.updated")
    .bind(format!("Updated settings for {}/{}", owner, updated.name))
    .execute(&state.db)
    .await?;

    Ok(Json(updated))
}

pub async fn delete_repository(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((owner, name)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    let user = current_user(&state, &headers).await?;
    let repo = find_repository(&state, &user, &owner, &name).await?;

    if !owner.eq_ignore_ascii_case(&user.username) {
        return Err(ApiError::Unauthorized(
            "Only the owner can delete this repository".into(),
        ));
    }

    sqlx::query("DELETE FROM repositories WHERE id = $1")
        .bind(repo.id)
        .execute(&state.db)
        .await?;

    sqlx::query("INSERT INTO activity_events (user_id, kind, summary) VALUES ($1, $2, $3)")
        .bind(user.id)
        .bind("repository.deleted")
        .bind(format!("Deleted repository {}/{}", owner, repo.name))
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct ActivityQuery {
    pub limit: Option<i64>,
}

pub async fn list_activity(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ActivityQuery>,
) -> ApiResult<Json<Vec<ActivityEvent>>> {
    let user = current_user(&state, &headers).await?;
    let limit = query.limit.unwrap_or(30).clamp(1, 100);

    let events = sqlx::query_as::<_, ActivityEvent>(
        "SELECT e.id, e.kind, e.summary, r.name AS repository_name, u.username AS actor, e.created_at \
         FROM activity_events e \
         LEFT JOIN repositories r ON r.id = e.repository_id \
         LEFT JOIN users u ON u.id = e.user_id \
         WHERE e.user_id = $1 \
         ORDER BY e.created_at DESC \
         LIMIT $2",
    )
    .bind(user.id)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(events))
}

pub async fn stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<serde_json::Value>> {
    let user = current_user(&state, &headers).await?;

    let (total, public, archived): (i64, i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), \
                COUNT(*) FILTER (WHERE visibility = 'public'), \
                COUNT(*) FILTER (WHERE archived) \
         FROM repositories WHERE owner_id = $1",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    let active_sessions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sessions \
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    let events_this_week: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM activity_events \
         WHERE user_id = $1 AND created_at > NOW() - interval '7 days'",
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "repositories": total,
        "publicRepositories": public,
        "archivedRepositories": archived,
        "activeSessions": active_sessions,
        "eventsThisWeek": events_this_week,
    })))
}
