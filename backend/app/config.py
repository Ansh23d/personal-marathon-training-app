from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    strava_client_id: str
    strava_client_secret: str
    strava_redirect_uri: str = "http://localhost:8000/auth/callback"
    database_url: str = "sqlite+aiosqlite:///./training.db"
    secret_key: str = "dev-secret-change-me"

    class Config:
        env_file = ".env"


settings = Settings()
