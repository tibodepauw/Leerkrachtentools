from __future__ import annotations

import logging
import re

from ..config import OFFICIAL_OVERVIEW_URLS
from ..downloader import join_base_url
from .base import SourceFetcher

logger = logging.getLogger(__name__)

OVERVIEW_URL = "https://pro.g-o.be/themas/leerplannen/basisonderwijs/"
BASE = "https://pro.g-o.be"

# Huidige vakgebieden - bewust zonder 'nieuw-leerplan-basisonderwijs'.
SUBJECT_PAGES: dict[str, str] = {
    "algemeen": "Algemeen deel leerplan",
    "media": "Leerplan media",
    "lichamelijke-opvoeding": "Leerplan lichamelijke opvoeding",
    "nederlands": "Leerplan Nederlands",
    "wiskunde": "Leerplan wiskunde",
    "wereldorientatie": "Leerplan wereldoriëntatie",
    "muzische-vorming": "Leerplan muzische vorming",
    "frans": "Leerplan Frans",
}

EXCLUDED_PATH_FRAGMENT = "nieuw-leerplan-basisonderwijs"


class GoFetcher(SourceFetcher):
    network = "GO"

    def fetch(self) -> int:
        success = 0
        collected: list[dict[str, str]] = []

        for slug, label in SUBJECT_PAGES.items():
            page_url = f"{OVERVIEW_URL}{slug}/"
            html = self.downloader.fetch_html(page_url, referer=OVERVIEW_URL)
            if html is None:
                continue

            links = set(
                re.findall(r'href="(/download/GOPRO[^"]+)"', html, flags=re.IGNORECASE)
            )

            pdf_links = [
                link
                for link in links
                if self._looks_like_pdf(link, slug)
            ]

            if not pdf_links:
                logger.warning("Geen PDF-downloadlinks op GO-pagina: %s", page_url)

            for path in sorted(pdf_links):
                if EXCLUDED_PATH_FRAGMENT in path:
                    logger.info("Overgeslagen (nieuw leerplan): %s", path)
                    continue

                title_part = path.split("/")[-1] if "/" in path else path
                brontitel = f"GO! - {label} - {title_part}"
                url = join_base_url(BASE, path)
                collected.append(
                    {"brontitel": brontitel, "source_url": url, "pagina": page_url}
                )
                if self.downloader.download_resource(
                    network=self.network,
                    url=url,
                    brontitel=brontitel,
                    referer=page_url,
                ):
                    success += 1

        self.downloader.download_json_export(
            network=self.network,
            payload={
                "network": self.network,
                "overzicht_url": OVERVIEW_URL,
                "uitgesloten": EXCLUDED_PATH_FRAGMENT,
                "overzicht_urls": OFFICIAL_OVERVIEW_URLS["GO"],
                "downloads": collected,
            },
            brontitel="GO! - overzicht huidige leerplan-PDF's",
            filename="_overzicht_bronnen.json",
            source_url=OVERVIEW_URL,
        )

        logger.info(
            "GO!: concept 'nieuw leerplan basisonderwijs' is bewust niet opgenomen."
        )
        return success

    @staticmethod
    def _looks_like_pdf(path: str, slug: str) -> bool:
        lowered = path.lower()
        if "pdf" in lowered:
            return True
        # Algemeen deel heeft geen '- pdf' in de bestandsnaam maar levert wel een PDF.
        if slug == "algemeen" and "algemeen deel leerplan" in lowered:
            return True
        return False
