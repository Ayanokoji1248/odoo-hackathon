from typing import Literal

from pydantic import model_validator
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
    access_token_expire_minutes: int = 15
    session_expire_days: int = 30
    reset_token_expire_minutes: int = 30

    # Cookie policy. Same-origin or proxied deployments want lax; a frontend on a
    # separate domain needs samesite=none, which browsers only accept when secure.
    cookie_secure: bool = True
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cookie_domain: str | None = None

    # ponytail: comma-separated, not list[str] — pydantic-settings only parses
    # complex types as JSON from env, and JSON in a .env file is a footgun.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _reject_unusable_cookie_policy(self) -> "Settings":
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError(
                "COOKIE_SAMESITE=none requires COOKIE_SECURE=true - browsers "
                "silently drop the cookie otherwise"
            )
        return self


settings = Settings()
