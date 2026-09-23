from pathlib import Path

import pytest

from title_normalizer.config import SettingsError, find_env_directory, load_settings


@pytest.fixture(autouse=True)
def clear_app_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("APP_NAME", "APP_SLUG"):
        monkeypatch.delenv(key, raising=False)


def test_find_env_directory_walks_up(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("APP_NAME=x\n")
    nested = tmp_path / "a" / "b"
    nested.mkdir(parents=True)

    assert find_env_directory(nested) == tmp_path


def test_local_file_overrides_base_file(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("APP_NAME=Base\nAPP_SLUG=base\n")
    (tmp_path / ".env.local").write_text("APP_NAME=Local\n")

    settings = load_settings(tmp_path)

    assert settings.app_name == "Local"
    assert settings.app_slug == "base"


def test_real_environment_wins(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / ".env").write_text("APP_NAME=File\nAPP_SLUG=file\n")
    monkeypatch.setenv("APP_NAME", "FromEnv")

    assert load_settings(tmp_path).app_name == "FromEnv"


def test_missing_keys_raise(tmp_path: Path) -> None:
    (tmp_path / ".env").write_text("APP_NAME=\n")

    with pytest.raises(SettingsError, match="APP_NAME, APP_SLUG"):
        load_settings(tmp_path)
