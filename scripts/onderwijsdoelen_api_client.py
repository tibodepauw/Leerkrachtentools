"""HTTP-client voor de Onderwijsdoelen API (x-api-key via ONDERWIJSDOELEN_API_KEY)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from education_record_schema import normalize_api_goal_record
from local_env import load_local_env

logger = logging.getLogger("onderwijsdoelen_api_client")

DEFAULT_API_BASE = "https://onderwijs.api.vlaanderen.be/onderwijsdoelen"
USER_AGENT = (
    "Leerkrachtentools-onderwijsdoelen/1.0 "
    "(publieke onderwijsdata; https://github.com/tibodepauw/Leerkrachtentools)"
)


class _RejectApiRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # urllib otherwise copies x-api-key, including cross-host/downgrade hops.
        # Returning None makes the real error handler raise before any next hop.
        return None


def _goal_identity(record: dict[str, Any]) -> str:
    """Code is scoped to its complete goal-set/type/dataset context, not global.

    Text/notes and top-level response metadata cannot turn the same goal into a
    new entity. Preserve the complete goal-set object, including its structure,
    instead of guessing which source context fields distinguish two goals.
    """
    source_id = record.get("@id")
    if isinstance(source_id, (str, int)) and not isinstance(source_id, bool) and str(source_id):
        # Real API records can share code, text and set while belonging to
        # different title hierarchies. The official primary key distinguishes
        # those; the same primary key may never inflate pagination totals.
        goal_set = record.get("onderwijsdoelenset")
        goal_set = goal_set if isinstance(goal_set, dict) else {}
        validity = record.get("geldigheid")
        validity = validity if isinstance(validity, dict) else {}
        return json.dumps({"source_id": source_id,
                           "source_set": goal_set.get("onderwijsdoelenset_id", goal_set),
                           "title_context": record.get("titels"),
                           "valid_from": validity.get("geldig_van_dt"),
                           "valid_until": validity.get("geldig_tot_dt"),
                           "type": record.get("onderwijsdoel_type"), "dataset": record.get("_dataset")},
                          sort_keys=True, separators=(",", ":"))
    if record.get("code") is not None:
        identity = {field: record.get(field) for field in (
            "code", "onderwijsdoelenset", "onderwijsdoel_type", "_dataset",
        )}
    else:
        identity = record
    return json.dumps(identity, sort_keys=True, separators=(",", ":"))


def resolve_api_key(api_key: str | None = None) -> str:
    load_local_env()
    key = (api_key or os.environ.get("ONDERWIJSDOELEN_API_KEY", "")).strip()
    if not key:
        raise ValueError(
            "ONDERWIJSDOELEN_API_KEY ontbreekt. Zet de key in .env.local "
            "(npm run fetch:all laadt dat bestand automatisch) of exporteer "
            "die voor fetch-scripts (zie docs/curriculum-bronnen-urls.md)."
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
    if rows_per_page < 1 or max_pages < 1:
        raise ValueError("Paginagrootte en paginalimiet moeten positief zijn.")
    collected: list[dict[str, Any]] = []
    expected_total: int | None = None
    seen_pages: set[str] = set()
    seen_records: set[str] = set()
    for page in range(1, max_pages + 1):
        url = (
            f"{DEFAULT_API_BASE}/onderwijsdoel?"
            f"paginanr={page}&rijen_per_pagina={rows_per_page}"
        )
        payload = _get_json(url, resolved_key)
        data = payload.get("gegevens") if isinstance(payload, dict) else None
        if not isinstance(data, dict) or not isinstance(data.get("member"), list) or not all(isinstance(item, dict) for item in data["member"]):
            raise RuntimeError("Onderwijsdoelen API: ongeldig paginapayload.")
        members = data["member"]
        total = data.get("totalItems")
        if total is not None:
            if isinstance(total, bool) or not str(total).isdigit():
                raise RuntimeError("Onderwijsdoelen API: ongeldig totaal.")
            total = int(total)
            if expected_total is not None and total != expected_total:
                raise RuntimeError("Onderwijsdoelen API: totaal tijdens ophalen gewijzigd.")
            expected_total = total
        if not members:
            if expected_total is not None and len(collected) != expected_total:
                raise RuntimeError("Onderwijsdoelen API: onvolledig, lege pagina vóór gerapporteerd totaal.")
            return collected
        fingerprint = hashlib.sha256(json.dumps(members, sort_keys=True).encode()).hexdigest()
        if fingerprint in seen_pages:
            raise RuntimeError("Onderwijsdoelen API: herhaalde pagina; volledigheid niet bewezen.")
        seen_pages.add(fingerprint)
        for member in members:
            identity = _goal_identity(member)
            if identity in seen_records:
                raise RuntimeError("Onderwijsdoelen API: overlap van doelrecords; volledigheid niet bewezen.")
            seen_records.add(identity)
        collected.extend(members)
        logger.info(
            "API pagina %s: +%s doelen (totaal %s / %s)",
            page,
            len(members),
            len(collected),
            total,
        )
        if expected_total is not None and len(collected) >= expected_total:
            if len(collected) != expected_total:
                raise RuntimeError("Onderwijsdoelen API: ongeldig aantal boven gerapporteerd totaal.")
            return collected
        time.sleep(pause_seconds)
    raise RuntimeError("Onderwijsdoelen API: onvolledig, paginalimiet bereikt vóór bewezen einde.")


def _get_json(url: str, api_key: str, retries: int = 4) -> dict[str, Any]:
    # Default proxy/CA/TLS handlers remain intact; only redirects are refused.
    opener = build_opener(_RejectApiRedirects())
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
            with opener.open(request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            last_error = exc
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

    payloads: list[Any] = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page()

        async def on_response(response) -> None:
            if "onderwijsdoel?" not in response.url or response.status != 200:
                return
            try:
                payloads.append(await response.json())
            except Exception:
                payloads.append(None)

        page.on("response", on_response)
        try:
            await page.goto(
                f"https://www.onderwijsdoelen.be/doelen/{dataset}",
                wait_until="networkidle",
                timeout=timeout_ms,
            )
            await page.wait_for_timeout(1500)
        finally:
            page.remove_listener("response", on_response)
            await browser.close()

    # Capturing a first browser page is not evidence that all goals were fetched.
    # Retry responses must not inflate the count to the server-reported total.
    collected: list[dict[str, Any]] = []
    totals: set[int] = set()
    seen: set[str] = set()
    for payload in payloads:
        data = payload.get("gegevens") if isinstance(payload, dict) else None
        if not isinstance(data, dict) or not isinstance(data.get("member"), list) or not all(isinstance(item, dict) for item in data["member"]):
            raise RuntimeError("Onderwijsdoelen portaal: ongeldige pagina; volledigheid niet bewezen.")
        total = data.get("totalItems")
        if total is None or isinstance(total, bool) or not str(total).isdigit():
            raise RuntimeError("Onderwijsdoelen portaal: volledigheid niet bewezen zonder geldig totaal.")
        totals.add(int(total))
        for member in data["member"]:
            fingerprint = json.dumps(member, sort_keys=True)
            if fingerprint not in seen:
                seen.add(fingerprint)
                collected.append({**member, "_dataset": dataset})
    if len(totals) != 1 or len(collected) != next(iter(totals)):
        raise RuntimeError("Onderwijsdoelen portaal: onvolledig of gewijzigd totaal; geen corpus gepubliceerd.")
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
