from __future__ import annotations

import logging
import re

from ..config import OFFICIAL_OVERVIEW_URLS
from .base import SourceFetcher

logger = logging.getLogger(__name__)

SCRAPE_PAGES = [
    (
        "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/",
        "OVSG Leer Lokaal - overzicht",
    ),
    (
        "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/leerplan-leer-lokaal",
        "OVSG Leerplan Leer Lokaal",
    ),
    (
        "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/leergebieden-leerlijnen-leerlokaal",
        "OVSG Leergebieden & visieteksten",
    ),
    (
        "https://www.ovsg.be/onze-themas/leerplannen-didactiek/basisonderwijs/leer-lokaal/faq-leer-lokaal",
        "OVSG FAQ Leer Lokaal",
    ),
]

LOGIN_GATED = [
    "https://leerlokaal.ovsg.be/",
    "https://leerlokaalupdate.ovsg.be/",
]


class OvsgFetcher(SourceFetcher):
    network = "OVSG"

    def fetch(self) -> int:
        success = 0
        pdf_urls: set[str] = set()

        for page_url, _ in SCRAPE_PAGES:
            html = self.downloader.fetch_html(page_url)
            if html is None:
                continue
            found = set(
                re.findall(
                    r'(https://www\.ovsg\.be[^"\']+\.pdf)',
                    html,
                    flags=re.IGNORECASE,
                )
            )
            pdf_urls.update(found)

        if not pdf_urls:
            logger.warning(
                "Geen publieke OVSG-PDF's gevonden. Volledig leerplan vereist login."
            )

        for url in sorted(pdf_urls):
            filename = url.split("/")[-1]
            brontitel = f"OVSG Leer Lokaal - {filename.replace('-', ' ').replace('.pdf', '')}"
            if self.downloader.download_resource(
                network=self.network,
                url=url,
                brontitel=brontitel,
                referer=SCRAPE_PAGES[0][0],
            ):
                success += 1

        for portal in LOGIN_GATED:
            logger.info(
                "OVSG login-portaal niet automatisch te downloaden: %s", portal
            )

        self.downloader.download_json_export(
            network=self.network,
            payload={
                "network": self.network,
                "overzicht_urls": OFFICIAL_OVERVIEW_URLS["OVSG"],
                "login_portals": LOGIN_GATED,
                "publieke_pdfs": sorted(pdf_urls),
            },
            brontitel="OVSG - overzicht officiële bronpagina's",
            filename="_overzicht_bronnen.json",
            source_url=SCRAPE_PAGES[0][0],
        )
        return success
