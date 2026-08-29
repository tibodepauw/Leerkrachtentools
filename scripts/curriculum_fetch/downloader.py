from __future__ import annotations

import logging
import re
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse

import requests

from .config import DEFAULT_ONDERWIJDSNIVEAU, USER_AGENT
from .metadata import FileMetadata

logger = logging.getLogger(__name__)


def encode_path(path: str) -> str:
    """Encodeer padsegmenten (nodig voor GO!-downloads met spaties)."""
    segments = [quote(segment, safe="") for segment in path.split("/") if segment]
    return "/" + "/".join(segments)


def join_base_url(base: str, path: str) -> str:
    """Combineer basis-URL met een (eventueel absolute) downloadpath."""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    normalized = encode_path(path) if not path.startswith("/") else encode_path(path)
    return base.rstrip("/") + normalized


def slugify_filename(name: str, max_length: int = 120) -> str:
    cleaned = re.sub(r"[^\w\s\-().]", "", name, flags=re.UNICODE)
    cleaned = re.sub(r"\s+", "_", cleaned.strip())
    if not cleaned:
        cleaned = "download"
    return cleaned[:max_length]


class CurriculumDownloader:
    def __init__(self, data_dir: Path, timeout: int = 60) -> None:
        self.data_dir = data_dir
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def network_dir(self, network: str) -> Path:
        folder_map = {
            "ZILL": "zill",
            "GO": "go",
            "OVSG": "ovsg",
            "MINIMUMDOELEN": "minimumdoelen",
        }
        path = self.data_dir / folder_map[network]
        path.mkdir(parents=True, exist_ok=True)
        return path

    def download_resource(
        self,
        *,
        network: str,
        url: str,
        brontitel: str,
        referer: str | None = None,
        filename: str | None = None,
        onderwijsniveau: str = DEFAULT_ONDERWIJDSNIVEAU,
        extra: dict | None = None,
    ) -> Path | None:
        headers = {}
        if referer:
            headers["Referer"] = referer

        try:
            response = self.session.get(
                url,
                headers=headers,
                timeout=self.timeout,
                allow_redirects=True,
                stream=True,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            logger.error("Download mislukt [%s] %s - %s", network, url, exc)
            return None

        content_type = response.headers.get("Content-Type", "")
        if "html" in content_type.lower() and not url.lower().endswith(".html"):
            logger.warning(
                "Verwacht bestand maar kreeg HTML [%s] %s", network, url
            )
            return None

        if filename is None:
            filename = self._derive_filename(url, response, brontitel)

        target = self.network_dir(network) / filename
        size = 0
        with target.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=65536):
                if chunk:
                    handle.write(chunk)
                    size += len(chunk)

        metadata = FileMetadata(
            network=network,
            onderwijsniveau=onderwijsniveau,
            brontitel=brontitel,
            source_url=url,
            content_type=content_type.split(";")[0].strip() or None,
            file_size=size,
            extra=extra or {},
        )
        metadata.write_sidecar(target)
        logger.info("Opgeslagen [%s] %s (%s bytes)", network, target.name, size)
        return target

    def download_json_export(
        self,
        *,
        network: str,
        payload: dict | list,
        brontitel: str,
        filename: str,
        source_url: str,
        onderwijsniveau: str = DEFAULT_ONDERWIJDSNIVEAU,
        extra: dict | None = None,
    ) -> Path:
        import json

        target = self.network_dir(network) / filename
        encoded = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
        target.write_text(encoded, encoding="utf-8")

        metadata = FileMetadata(
            network=network,
            onderwijsniveau=onderwijsniveau,
            brontitel=brontitel,
            source_url=source_url,
            content_type="application/json",
            file_size=target.stat().st_size,
            extra=extra or {},
        )
        metadata.write_sidecar(target)
        logger.info("JSON opgeslagen [%s] %s", network, target.name)
        return target

    def fetch_html(self, url: str, referer: str | None = None) -> str | None:
        headers = {}
        if referer:
            headers["Referer"] = referer
        try:
            response = self.session.get(
                url, headers=headers, timeout=self.timeout, allow_redirects=True
            )
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            logger.error("Pagina niet bereikbaar: %s - %s", url, exc)
            return None

    def absolute_url(self, base: str, href: str) -> str:
        return urljoin(base, href)

    def _derive_filename(
        self, url: str, response: requests.Response, brontitel: str
    ) -> str:
        parsed = urlparse(url)
        basename = Path(parsed.path).name
        if basename and "." in basename:
            return slugify_filename(basename)

        disposition = response.headers.get("Content-Disposition", "")
        match = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', disposition)
        if match:
            return slugify_filename(match.group(1))

        content_type = response.headers.get("Content-Type", "")
        extension = ".pdf" if "pdf" in content_type else ".bin"
        return slugify_filename(brontitel) + extension
