from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = "http://localhost:3000,https://avennex.com,https://staging.avennex.com"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_general_user: str = ""
    smtp_general_password: str = ""
    smtp_careers_user: str = ""
    smtp_careers_password: str = ""
    smtp_from_general: str = ""
    smtp_from_careers: str = ""

    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""

    model_config = {"env_file": ".env"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
