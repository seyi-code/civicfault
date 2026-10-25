from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: str = "development"
    debug: bool = True
    # Set SECRET_KEY once on Railway and never change it (changing invalidates all logins)
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "postgresql+psycopg2://civic:civic@localhost:5432/civicfault"

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    cluster_radius_meters: float = 50.0

    upload_dir: str = "static/uploads"
    max_upload_mb: int = 8
    allowed_image_types: str = "image/jpeg,image/png,image/webp"

    storage_backend: str = "local"
    s3_bucket: Optional[str] = None
    s3_region: str = "us-east-1"
    s3_endpoint_url: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_public_base_url: Optional[str] = None

    yolo_model_path: str = ""

    rate_limit_reports: str = "10/minute"
    rate_limit_default: str = "60/minute"

    min_upvotes_for_public: int = 0

    paystack_secret_key: Optional[str] = None
    paystack_public_key: Optional[str] = None
    paystack_callback_url: Optional[str] = None

    flutterwave_secret_key: Optional[str] = None
    flutterwave_public_key: Optional[str] = None

    notify_provider: str = "africastalking"
    africastalking_username: Optional[str] = None
    africastalking_api_key: Optional[str] = None
    africastalking_from: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_sms_from: Optional[str] = None
    twilio_whatsapp_from: Optional[str] = None

    # Header X-Cron-Secret for POST /api/v1/cron/digests
    cron_secret: Optional[str] = None

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def allowed_image_types_list(self) -> List[str]:
        return [t.strip() for t in self.allowed_image_types.split(",") if t.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
