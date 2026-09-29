mod auth;
mod error;
mod models;
mod repos;

use axum::{
    routing::{delete, get, patch, post},
    Json, Router,
};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower_http::cors::CorsLayer;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
}

async fn health(axum::extract::State(state): axum::extract::State<AppState>) -> Json<serde_json::Value> {
    let database_up = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.db)
        .await
        .is_ok();

    Json(serde_json::json!({
        "service": "gitop-api",
        "runtime": "rust",
        "version": env!("CARGO_PKG_VERSION"),
        "status": if database_up { "healthy" } else { "degraded" },
        "database": database_up,
    }))
}

fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        .route("/api/users/me", patch(auth::update_profile))
        .route("/api/users/me/password", post(auth::change_password))
        .route("/api/sessions", get(auth::list_sessions))
        .route("/api/sessions/:id", delete(auth::revoke_session))
        .route(
            "/api/repos",
            get(repos::list_repositories).post(repos::create_repository),
        )
        .route(
            "/api/repos/:owner/:name",
            get(repos::get_repository)
                .patch(repos::update_repository)
                .delete(repos::delete_repository),
        )
        .route("/api/activity", get(repos::list_activity))
        .route("/api/stats", get(repos::stats))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "gitop_api=info,tower_http=warn".into()),
        )
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL must be set (see .env.example)"))?;
    let port: u16 = std::env::var("API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&db).await?;

    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await?;
    tracing::info!("gitop-api listening on http://0.0.0.0:{port}");

    axum::serve(listener, router(AppState { db })).await?;
    Ok(())
}
