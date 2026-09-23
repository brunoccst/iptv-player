"""Loads public app settings from the repo root .env. Real environment variables win."""

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


def find_env_directory(start: Path) -> Path | None:
    for directory in (start, *start.parents):
        if (directory / ".env").is_file():
            return directory
    return None


def load_settings(start: Path | None = None) -> Settings:
    env_directory = find_env_directory((start or Path(__file__)).resolve())
    if env_directory is not None:
        # .env.local first: load_dotenv never overrides already-set values.
        load_dotenv(env_directory / ".env.local", override=False)
        load_dotenv(env_directory / ".env", override=False)

    missing = [key for key in ("APP_NAME", "APP_SLUG") if not os.environ.get(key, "").strip()]
    if missing:
        raise SettingsError(f"Missing required app config keys: {', '.join(missing)}. Check the root .env file.")

    return Settings(app_name=os.environ["APP_NAME"].strip(), app_slug=os.environ["APP_SLUG"].strip())
