from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class FileMetadata:
    network: str
    onderwijsniveau: str
    brontitel: str
    source_url: str
    downloaded_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    content_type: str | None = None
    file_size: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        if not payload["extra"]:
            del payload["extra"]
        return payload

    def write_sidecar(self, target_file: Path) -> Path:
        sidecar = target_file.with_suffix(target_file.suffix + ".meta.json")
        sidecar.write_text(
            json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return sidecar
