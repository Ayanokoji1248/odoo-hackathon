from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Validated at import time — the app refuses to boot on a missing env var."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "GlobeTrotter API"
    version: str = "0.1.0"
    debug: bool = False
    # Separate from debug on purpose: DEBUG=true is the normal dev setting, and
    # dumping every statement drowns anything else you were trying to read.
    sql_echo: bool = False

    # postgresql+asyncpg://user:pass@host:port/db
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    reset_token_expire_minutes: int = 30

    # ponytail: comma-separated, not list[str] — pydantic-settings only parses
    # complex types as JSON from env, and JSON in a .env file is a footgun.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
