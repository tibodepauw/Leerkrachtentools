from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod

from ..downloader import CurriculumDownloader, encode_path

logger = logging.getLogger(__name__)


class SourceFetcher(ABC):
    network: str

    def __init__(self, downloader: CurriculumDownloader) -> None:
        self.downloader = downloader

    @abstractmethod
    def fetch(self) -> int:
        """Download bronnen; retourneer aantal geslaagde downloads."""


def extract_pdf_links(html: str, base_url: str, pattern: str) -> list[tuple[str, str]]:
    """Zoek downloadlinks en geef (url, titel) terug."""
    results: list[tuple[str, str]] = []
    seen: set[str] = set()

    for match in re.finditer(pattern, html, flags=re.IGNORECASE):
        href = match.group(1)
        title = match.group(2) if match.lastindex and match.lastindex >= 2 else href
        url = href if href.startswith("http") else f"{base_url.rstrip('/')}{href}"
        if url in seen:
            continue
        seen.add(url)
        results.append((url, title.strip()))

    return results
