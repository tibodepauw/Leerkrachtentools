from __future__ import annotations

import logging
import re

from ..config import OFFICIAL_OVERVIEW_URLS
from ..downloader import join_base_url
from .base import SourceFetcher

logger = logging.getLogger(__name__)

ORDENINGSKADER_URL = (
    "https://pro.katholiekonderwijs.vlaanderen/"
    "achtergrond-bij-ontwikkelvelden/het-ordeningskader"
)
BASE = "https://pro.katholiekonderwijs.vlaanderen"


class ZillFetcher(SourceFetcher):
    network = "ZILL"

    def fetch(self) -> int:
        success = 0
        html = self.downloader.fetch_html(ORDENINGSKADER_URL)
        if html is None:
            return 0

        paths = set(
            re.findall(
                r'(/download/content/[^"\']+\.pdf)',
                html,
                flags=re.IGNORECASE,
            )
        )

        if not paths:
            logger.warning(
                "Geen PDF-links gevonden op ZILL-ordeningskaderpagina. "
                "Controleer %s",
                ORDENINGSKADER_URL,
            )

        for path in sorted(paths):
            filename = path.split("/")[-1]
            brontitel = f"ZILL — {filename}"
            url = join_base_url(BASE, path)
            if self.downloader.download_resource(
                network=self.network,
                url=url,
                brontitel=brontitel,
                referer=ORDENINGSKADER_URL,
            ):
                success += 1

        self._write_overview_manifest()
        logger.info(
            "ZILL: digitaal leerplan staat op %s (geen bulk-PDF).",
            OFFICIAL_OVERVIEW_URLS["ZILL"][0]["url"],
        )
        return success

    def _write_overview_manifest(self) -> None:
        self.downloader.download_json_export(
            network=self.network,
            payload={
                "network": self.network,
                "digitaal_leerplan_url": OFFICIAL_OVERVIEW_URLS["ZILL"][0]["url"],
                "downloadhub_url": ORDENINGSKADER_URL,
                "overzicht_urls": OFFICIAL_OVERVIEW_URLS["ZILL"],
            },
            brontitel="ZILL — overzicht officiële bronpagina's",
            filename="_overzicht_bronnen.json",
            source_url=ORDENINGSKADER_URL,
        )
