"""Loads settings from the repo root .env (then .env.local). Real environment variables win."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


class SettingsError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_slug: str
    data_dir: Path

    @property
    def pipeline_db_path(self) -> Path:
        """Queue + master media database shared with the backend."""
        return self.data_dir / "pipeline.db"


def find_env_directory(start: Path) -> Path | None:
    for directory in (start, *start.parents):
        if (directory / ".env").is_file():
            return directory
    return None


def load_settings(start: Path | None = None) -> Settings:
    start_path = (start or Path(__file__)).resolve()
    env_directory = find_env_directory(start_path)
    if env_directory is not None:
        # .env.local first: load_dotenv never overrides already-set values.
        load_dotenv(env_directory / ".env.local", override=False)
        load_dotenv(env_directory / ".env", override=False)

    missing = [key for key in ("APP_NAME", "APP_SLUG") if not os.environ.get(key, "").strip()]
    if missing:
        raise SettingsError(f"Missing required app config keys: {', '.join(missing)}. Check the root .env file.")

    # Relative DATA_DIR resolves against the .env directory, same rule as the backend.
    base = env_directory or (start_path if start_path.is_dir() else start_path.parent)
    data_dir = (base / (os.environ.get("DATA_DIR", "").strip() or ".data")).resolve()

    return Settings(app_name=os.environ["APP_NAME"].strip(), app_slug=os.environ["APP_SLUG"].strip(), data_dir=data_dir)
