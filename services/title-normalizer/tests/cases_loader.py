"""Loads the JSON cases shared with the TypeScript port (packages/shared/src/direct/normalizer). See DECISIONS.md#d-038."""

import json
from pathlib import Path

CASES = Path(__file__).parent / "cases"


def load(name: str) -> dict:
    return json.loads((CASES / f"{name}.json").read_text(encoding="utf-8"))
