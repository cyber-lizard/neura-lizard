from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

APP_DIR = Path.home() / ".neuralizard"
APP_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    db_url: str
    default_provider: str = "openai"

    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    google_api_key: str | None = Field(default=None, alias="GOOGLE_API_KEY")
    mistral_api_key: str | None = Field(default=None, alias="MISTRAL_API_KEY")
    cohere_api_key: str | None = Field(default=None, alias="COHERE_API_KEY")
    xai_api_key: str | None = Field(default=None, alias="XAI_API_KEY")
    deepseek_api_key: str | None = Field(default=None, env="DEEPSEEK_API_KEY")

    model_config = SettingsConfigDict(
        env_file=str(APP_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
