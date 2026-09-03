from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = Field(default="development")
    port: int = Field(default=4007)
    database_url: str
    products_service_url: str = Field(default="http://localhost:4002")
    anthropic_api_key: str
    llm_model: str = Field(default="claude-haiku-4-5-20251001")
    aws_region: str = Field(default="us-east-1")
    aws_endpoint_url: str = Field(default="http://localhost:4566")
    product_changed_queue_url: str


# Parsed once at import time, mirroring the other services' env.ts pattern —
# a required field missing from the environment fails fast at startup.
settings = Settings()
