from __future__ import annotations

import logging
import os
import re
from typing import Any

import requests

from ..config import OFFICIAL_OVERVIEW_URLS
from .base import SourceFetcher

logger = logging.getLogger(__name__)

PORTAL_URL = "https://www.onderwijsdoelen.be/"
PROFESSIONALS_URL = (
    "https://www.vlaanderen.be/onderwijsprofessionals/lesgeven-en-begeleiden/"
    "opleidingsinhouden/opleidingsinhouden-basisonderwijs/nieuwe-minimumdoelen-basisonderwijs"
)

# Publiek bereikbare PDF's (assets.vlaanderen.be werkt betrouwbaarder dan sommige
# data-onderwijs-hosts). JSON-doelen komen via de Onderwijsdoelen-API.
STATIC_PDF_SOURCES: list[dict[str, str]] = [
    {
        "url": "https://assets.vlaanderen.be/image/upload/v1753260185/repositories-prd/Decereet_en_bijlage_minimumdoelen_basisonderwijs_bcof1o.pdf",
        "brontitel": "Decreet en bijlage minimumdoelen basisonderwijs",
    },
    {
        "url": "https://assets.vlaanderen.be/image/upload/v1758804426/repositories-prd/DEF_Rapport_Vlaamse_kennisrijke_Minimumdoelen_PDF_lusrpp.pdf",
        "brontitel": "Rapport Vlaamse kennisrijke minimumdoelen",
    },
    {
        "url": "https://data-onderwijs.vlaanderen.be/documenten/bestanden/Flyer-Minimumdoelen-Digitaal.pdf",
        "brontitel": "Flyer minimumdoelen basisonderwijs (digitaal)",
    },
    {
        "url": "https://data-onderwijs.vlaanderen.be/documenten/bestanden/Flyer-Minimumdoelen-Print.pdf",
        "brontitel": "Flyer minimumdoelen basisonderwijs (print A5)",
    },
    {
        "url": "https://data-onderwijs.vlaanderen.be/documenten/bestanden/Presentatie-minimumdoelen-basisonderwijs.pdf",
        "brontitel": "Presentatie minimumdoelen basisonderwijs",
    },
    {
        "url": "https://data-onderwijs.vlaanderen.be/documenten/bestanden/20250701_SWL_Toelichting_apis_KenC.pdf",
        "brontitel": "Toelichting API's Kwalificaties & Curriculum (Onderwijsdoelen-API)",
    },
]

# Configureerbaar via env; exact pad staat in de Swagger op het API-portaal.
DEFAULT_API_BASE = os.environ.get(
    "ONDERWIJSDOELEN_API_BASE",
    "https://onderwijs-vlaanderen-portaalov.apigee.io",
)
DEFAULT_API_PATH = os.environ.get(
    "ONDERWIJSDOELEN_API_PATH",
    "/v1/onderwijsdoelen/doelen",
)


class MinimumdoelenFetcher(SourceFetcher):
    network = "MINIMUMDOELEN"

    def fetch(self) -> int:
        success = 0

        for item in STATIC_PDF_SOURCES:
            if self.downloader.download_resource(
                network=self.network,
                url=item["url"],
                brontitel=item["brontitel"],
                referer=PROFESSIONALS_URL,
            ):
                success += 1

        api_key = os.environ.get("ONDERWIJSDOELEN_API_KEY", "").strip()
        api_payload: dict[str, Any] | None = None

        if api_key:
            api_payload = self._fetch_api(api_key)
            if api_payload is not None:
                self.downloader.download_json_export(
                    network=self.network,
                    payload=api_payload,
                    brontitel="Onderwijsdoelen API - basisonderwijs lager onderwijs",
                    filename="onderwijsdoelen_basisonderwijs_lo.json",
                    source_url=DEFAULT_API_BASE + DEFAULT_API_PATH,
                    extra={"filter": "basisonderwijs / lager onderwijs"},
                )
                success += 1
        else:
            logger.warning(
                "ONDERWIJSDOELEN_API_KEY niet gezet - JSON-doelen overgeslagen. "
                "Vraag een key aan via https://onderwijs-api-portaal.vlaanderen.be/apis"
            )

        scraped = self._scrape_professionals_page()
        self.downloader.download_json_export(
            network=self.network,
            payload={
                "network": self.network,
                "portal_url": PORTAL_URL,
                "overzicht_urls": OFFICIAL_OVERVIEW_URLS["MINIMUMDOELEN"],
                "gevonden_documentlinks": scraped,
                "api_configured": bool(api_key),
                "api_base": DEFAULT_API_BASE,
                "api_path": DEFAULT_API_PATH,
            },
            brontitel="Minimumdoelen - overzicht officiële bronpagina's",
            filename="_overzicht_bronnen.json",
            source_url=PORTAL_URL,
        )

        return success

    def _scrape_professionals_page(self) -> list[str]:
        html = self.downloader.fetch_html(PROFESSIONALS_URL)
        if html is None:
            return []
        links = set(
            re.findall(
                r'https://(?:assets\.vlaanderen\.be|data-onderwijs\.vlaanderen\.be)[^"\']+',
                html,
            )
        )
        return sorted(links)

    def _fetch_api(self, api_key: str) -> dict[str, Any] | list[Any] | None:
        url = DEFAULT_API_BASE.rstrip("/") + DEFAULT_API_PATH
        params = {
            "onderwijsniveau": "basisonderwijs",
            "graad": "lager onderwijs",
        }
        headers = {
            "apikey": api_key,
            "Accept": "application/json",
        }

        try:
            response = self.downloader.session.get(
                url,
                params=params,
                headers=headers,
                timeout=self.downloader.timeout,
            )
            if response.status_code == 404:
                logger.error(
                    "Onderwijsdoelen-API-endpoint niet gevonden (%s). "
                    "Pas ONDERWIJSDOELEN_API_PATH aan volgens Swagger op het API-portaal.",
                    url,
                )
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            logger.error("Onderwijsdoelen-API mislukt: %s - %s", url, exc)
            return None
