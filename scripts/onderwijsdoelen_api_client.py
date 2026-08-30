"""HTTP-client voor de Onderwijsdoelen API (x-api-key via ONDERWIJSDOELEN_API_KEY)."""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from education_record_schema import normalize_api_goal_record

logger = logging.getLogger("onderwijsdoelen_api_client")

DEFAULT_API_BASE = "https://onderwijs.api.vlaanderen.be/onderwijsdoelen"
USER_AGENT = (
    "Leerkrachtentools-onderwijsdoelen/1.0 "
    "(publieke onderwijsdata; https://github.com/tibodepauw/Leerkrachtentools)"
)


def resolve_api_key(api_key: str | None = None) -> str:
    key = (api_key or os.environ.get("ONDERWIJSDOELEN_API_KEY", "")).strip()
    if not key:
        raise ValueError(
            "ONDERWIJSDOELEN_API_KEY ontbreekt. Zet de key in .env.local of "
            "exporteer die voor fetch-scripts (zie docs/curriculum-bronnen-urls.md)."
        )
    return key


def fetch_all_goals(
    *,
    api_key: str | None = None,
    rows_per_page: int = 500,
    max_pages: int = 60,
    pause_seconds: float = 0.15,
) -> list[dict[str, Any]]:
    resolved_key = resolve_api_key(api_key)
    collected: list[dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        url = (
            f"{DEFAULT_API_BASE}/onderwijsdoel?"
            f"paginanr={page}&rijen_per_pagina={rows_per_page}"
        )
        payload = _get_json(url, resolved_key)
        members = payload.get("gegevens", {}).get("member", [])
        if not members:
            break
        collected.extend(members)
        total = payload.get("gegevens", {}).get("totalItems")
        logger.info(
            "API pagina %s: +%s doelen (totaal %s / %s)",
            page,
            len(members),
            len(collected),
            total,
        )
        if total and len(collected) >= int(total):
            break
        time.sleep(pause_seconds)
    return collected


def _get_json(url: str, api_key: str, retries: int = 4) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = Request(
                url,
                headers={
                    "x-api-key": api_key,
                    "Accept": "application/json",
                    "User-Agent": USER_AGENT,
                },
            )
            with urlopen(request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            last_error = exc
            if exc.code == 404:
                return {"gegevens": {"member": []}}
            if exc.code in {429, 500, 502, 503, 504}:
                time.sleep(2 ** attempt)
                continue
            raise
        except Exception as exc:
            last_error = exc
            time.sleep(2 ** attempt)
    if last_error:
        raise last_error
    return {"gegevens": {"member": []}}


async def fetch_portal_dataset(
    dataset: str,
    *,
    timeout_ms: int = 120_000,
) -> list[dict[str, Any]]:
    from playwright.async_api import async_playwright

    collected: list[dict[str, Any]] = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()

        async def on_response(response) -> None:
            if "onderwijsdoel?" not in response.url or response.status != 200:
                return
            try:
                payload = await response.json()
            except Exception:
                return
            members = payload.get("gegevens", {}).get("member", [])
            if isinstance(members, list):
                for member in members:
                    if isinstance(member, dict):
                        tagged = dict(member)
                        tagged["_dataset"] = dataset
                        collected.append(tagged)

        page.on("response", on_response)
        await page.goto(
            f"https://www.onderwijsdoelen.be/doelen/{dataset}",
            wait_until="networkidle",
            timeout=timeout_ms,
        )
        await page.wait_for_timeout(1500)
        page.remove_listener("response", on_response)
        await browser.close()
    return collected


def normalize_goals(
    raw_records: Iterable[dict[str, Any]],
    *,
    dataset: str = "",
) -> list[dict[str, str]]:
    unique: dict[tuple[str, str, str], dict[str, str]] = {}
    for raw in raw_records:
        record = normalize_api_goal_record(raw, dataset=dataset)
        if not record:
            continue
        key = (record["onderwijsniveau"], record["code"], record["titel"].casefold())
        unique.setdefault(key, record)
    return list(unique.values())


def write_jsonl(path: Path, records: Iterable[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    items = list(records)
    with path.open("w", encoding="utf-8") as handle:
        for record in items:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    return len(items)
