"""Laad .env.local / .env voor curriculum-fetch scripts."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def unquote_env_value(value: str) -> str:
    text = value.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        return text[1:-1]
    return text


def parse_env_line(line: str) -> tuple[str, str] | None:
    text = line.strip()
    if not text or text.startswith("#"):
        return None
    if text.startswith("export "):
        text = text[7:].strip()
    if "=" not in text:
        return None
    key, value = text.split("=", 1)
    key = key.strip()
    if not key:
        return None
    return key, unquote_env_value(value)


def apply_env_file(path: Path, *, override: bool = False) -> None:
    for raw in path.read_text(encoding="utf-8").splitlines():
        parsed = parse_env_line(raw)
        if parsed is None:
            continue
        key, value = parsed
        if not override and key in os.environ:
            continue
        os.environ[key] = value


def load_local_env(root: Path | None = None) -> Path | None:
    base = root or ROOT
    loaded: Path | None = None
    for name in (".env.local", ".env"):
        path = base / name
        if not path.is_file():
            continue
        apply_env_file(path)
        if loaded is None:
            loaded = path
    return loaded
