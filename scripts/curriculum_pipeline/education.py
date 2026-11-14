"""Current education goals, with complete pagination and retained raw snapshots."""
from __future__ import annotations

import hashlib
import json
import logging
import re
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin, urlsplit

from .adapters import Harvest, IncompleteSource
from .http import HttpCache, SourceBlocked
from .registry import Dataset
from .store import canonical

PORTAL = "https://www.onderwijsdoelen.be/"
API = "https://onderwijs.api.vlaanderen.be/onderwijsdoelen"
FAMILY = {"SECUNDAIR": "SECUNDAIR_MINIMUMDOELEN", "KLEUTER": "BASISONDERWIJS_MINIMUMDOELEN",
          "LAGER": "BASISONDERWIJS_MINIMUMDOELEN", **{key: key for key in ["BUBAO", "BUSO", "OKAN", "DKO", "VOLWASSENEN", "HOGER"]}}


def portal_config(http: HttpCache):
    from bs4 import BeautifulSoup
    page = http.fetch(PORTAL)
    soup = BeautifulSoup(page.content, "html.parser")
    scripts = [urljoin(PORTAL, node["src"]) for node in soup.find_all("script", src=True)
               if urlsplit(urljoin(PORTAL, node["src"])).path == "/env.js"]
    if len(scripts) != 1:
        raise IncompleteSource("Onderwijsdoelen: actuele portaalconfiguratie niet eenduidig gevonden.")
    config = http.fetch(scripts[0])
    # Read literal public configuration only. Never evaluate downloaded scripts.
    url = re.search(r'\bapi_url\s*:\s*[\'"]([^\'"\r\n]+)[\'"]', config.text)
    key = re.search(r'\bapi_key\s*:\s*[\'"]([^\'"\r\n]+)[\'"]', config.text)
    if not url or url[1].rstrip("/") != API or not key or not 1 <= len(key[1]) <= 200:
        raise SourceBlocked("De publieke portaalconfiguratie verwijst niet naar de gecontroleerde onderwijsdoelen-API.")
    return key[1], [page, config]


def current_goal(raw: dict, *, at: datetime | None = None) -> bool:
    at = at or datetime.now(timezone.utc)
    validity = raw.get("geldigheid")
    if not isinstance(validity, dict):
        raise IncompleteSource("Een onderwijsdoel mist zijn officiële geldigheidsinformatie.")
    kind = str(validity.get("type", "")).casefold().strip()
    if kind not in {"geldig", "vervallen", "niet geldig", "niet meer geldig", "nog niet geldig", "toekomstig", "ingetrokken", "onbekend"}:
        raise IncompleteSource(f"Nieuwe of onbekende geldigheidsstatus: {kind[:80]!r}; controle nodig.")
    if kind != "geldig":
        return False
    for key, is_start in [("geldig_van_dt", True), ("geldig_tot_dt", False)]:
        if not validity.get(key):
            continue
        try:
            value = datetime.fromisoformat(str(validity[key]).replace("Z", "+00:00"))
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
        except ValueError:
            raise IncompleteSource("Ongeldige brondatum bij onderwijsdoel.") from None
        if is_start and value > at or not is_start and value <= at:
            return False
    return True


def fetch_pages(http: HttpCache, headers: dict, *, page_size=500, max_pages=200):
    from onderwijsdoelen_api_client import _goal_identity
    records, resources, inventory = [], [], []
    seen, page_hashes, total = set(), set(), None
    for page in range(1, max_pages + 1):
        url = API + "/onderwijsdoel?" + urlencode({"paginanr": page, "rijen_per_pagina": page_size})
        resource = http.fetch(url, headers=headers)
        resources.append(resource)
        payload = json.loads(resource.content)
        data = payload.get("gegevens") if isinstance(payload, dict) else None
        members = data.get("member") if isinstance(data, dict) else None
        count = data.get("totalItems") if isinstance(data, dict) else None
        if (not isinstance(members, list) or not all(isinstance(item, dict) for item in members)
                or isinstance(count, bool) or not str(count).isdigit()):
            raise IncompleteSource("Onderwijsdoelen: pagina mist een geldig totaal of doelrecords.")
        if total is not None and total != int(count):
            raise IncompleteSource("Onderwijsdoelen: gerapporteerd totaal wijzigde tijdens de update.")
        total = int(count)
        page_hash = hashlib.sha256(canonical(members).encode()).hexdigest()
        if page_hash in page_hashes:
            raise IncompleteSource("Onderwijsdoelen: herhaalde pagina; geen gedeeltelijk corpus gepubliceerd.")
        page_hashes.add(page_hash)
        for member in members:
            identity = _goal_identity(member)
            if identity in seen:
                raise IncompleteSource("Onderwijsdoelen: overlappende pagina's; volledigheid niet bewezen.")
            seen.add(identity)
            records.append((member, resource))
        inventory.append({"url": url, "sha256": page_hash, "records": len(members)})
        logging.info("Onderwijsdoelen: %s van %s bronrecords", len(records), total)
        if len(records) == total:
            return records, resources, inventory, total
        if not members or len(records) > total:
            raise IncompleteSource("Onderwijsdoelen: onvolledige of te grote paginareeks.")
    raise IncompleteSource("Onderwijsdoelen: paginalimiet bereikt vóór het brontotaal.")


def education(dataset: Dataset, http: HttpCache) -> Harvest:
    from education_record_schema import classify_domain, normalize_api_goal_record
    if not hasattr(http, "education_bundle"):
        key, portal = portal_config(http)
        raw, resources, inventory, total = fetch_pages(http, {"x-api-key": key, "Accept": "application/json"})
        kinds = Counter(str(row.get("geldigheid", {}).get("type", "")) for row, _ in raw)
        logging.info("Onderwijsdoelen geldigheid: %s", dict(kinds))
        grouped = {key: [] for key in set(FAMILY.values())}
        counts, inactive, unresolved = Counter(), Counter(), Counter()
        source_rows = []
        for row, resource in raw:
            goal_set = row.get("onderwijsdoelenset") or {}
            domain = classify_domain(set_name=str(goal_set.get("onderwijsdoelenset", "")),
                                     struct=goal_set.get("onderwijsstructuur") or {})
            family = FAMILY.get(domain)
            counts[domain or "UNMAPPED"] += 1
            from onderwijsdoelen_api_client import _goal_identity
            source_rows.append({"id": hashlib.sha256(_goal_identity(row).encode()).hexdigest(),
                                "domain": domain or "UNMAPPED",
                                "validity": str(row.get("geldigheid", {}).get("type", "")), "payload": row,
                                "source_url": resource.url, "source_sha256": resource.sha256})
            if str(row.get("geldigheid", {}).get("type", "")).casefold() == "onbekend":
                unresolved[domain or "UNMAPPED"] += 1
            if not current_goal(row):
                inactive[domain or "UNMAPPED"] += 1
                continue
            if not family:
                raise IncompleteSource("Actuele bron bevat een nieuw onderwijsniveau dat nog niet is geclassificeerd.")
            normalized = normalize_api_goal_record(row, source_url=PORTAL, min_text_length=1)
            if not normalized:
                raise IncompleteSource("Actueel onderwijsdoel mist code of tekst; geen verlies stilzwijgend toegestaan.")
            normalized.update(bron_id=row.get("@id"), bron_record=row,
                              onderwijsdoelenset=goal_set, onderwijsdoel_type=row.get("onderwijsdoel_type"),
                              geldigheid=row["geldigheid"], bron_api_url=resource.url,
                              titels=row.get("titels"),
                              bron_sha256=resource.sha256,
                              stroom=str(goal_set.get("onderwijsstructuur", {}).get("stroom", "")))
            grouped[family].append(normalized)
        http.education_raw_rows = source_rows
        http.education_bundle = (grouped, portal + resources, inventory, total, dict(kinds), dict(counts), dict(inactive), dict(unresolved))
    grouped, resources, inventory, total, kinds, counts, inactive, unresolved = http.education_bundle
    records = grouped[dataset.id]
    if not records:
        raise IncompleteSource(f"Geen actuele doelen voor {dataset.id}; geen leeg corpus gepubliceerd.")
    # Date boundaries can change the active set while the API bytes stay identical.
    active_hash = hashlib.sha256(canonical(records).encode()).hexdigest()
    return Harvest(resources, inventory + [{"dataset": dataset.id, "active_records_sha256": active_hash}], lambda: records,
                   {"complete": True, "api_total": total, "api_received": total,
                    "current_records": len(records), "validity_types": kinds,
                    "all_domains": counts, "excluded_inactive": inactive,
                    "scope": "Alle door de bron expliciet geldig verklaarde doelen binnen hun datumbereik",
                    "unknown_validity_retained_separately": unresolved,
                    "raw_snapshot": "Alle API-pagina's bewaard, ook van vervallen of toekomstige doelen",
                    "access": "Publieke portaalclientconfiguratie, geen persoonlijke sleutel"})
