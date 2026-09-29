use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    Conflict(String),
    TooManyRequests(String),
    Internal(String),
}

impl ApiError {
    fn parts(&self) -> (StatusCode, &str) {
        match self {
            ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.as_str()),
            ApiError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.as_str()),
            ApiError::NotFound(m) => (StatusCode::NOT_FOUND, m.as_str()),
            ApiError::Conflict(m) => (StatusCode::CONFLICT, m.as_str()),
            ApiError::TooManyRequests(m) => (StatusCode::TOO_MANY_REQUESTS, m.as_str()),
            ApiError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m.as_str()),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = self.parts();
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        tracing::error!(?err, "database error");
        ApiError::Internal("Database error".into())
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
