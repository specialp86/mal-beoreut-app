"""YAML 설정 파일 로더."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

DEFAULT_CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


def load_yaml(path: str | Path) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_scoring_config(path: str | Path | None = None) -> dict[str, Any]:
    return load_yaml(path or DEFAULT_CONFIG_DIR / "scoring_weights.yaml")


def load_scenario_config(path: str | Path | None = None) -> dict[str, Any]:
    return load_yaml(path or DEFAULT_CONFIG_DIR / "scenario_rules.yaml")
