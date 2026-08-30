"""Gedeelde normalisatie voor secundaire minimumdoelen (API + portaal)."""

from __future__ import annotations

import html
import re
from typing import Any, Iterable

from secondary_record_schema import normalize_minimum_goal_record as build_secondary_record

SC_LABELS: dict[str, str] = {
    "1": "Lichamelijke en geestelijke gezondheid",
    "2": "Nederlands",
    "3": "Andere talen",
    "4": "Digitale competenties",
    "5": "Sociaal-relationele competenties",
    "6": "Wiskunde - natuurwetenschappen - technologie en techniek (STEM)",
    "7": "Burgerschapscompetenties",
    "8": "Cultureel bewustzijn",
    "9": "Historisch bewustzijn",
    "10": "Leercompetenties",
    "11": "Ondernemerscompetenties",
    "12": "Juridische competenties",
    "13": "Duurzaamheid",
    "14": "Esthetische competenties",
    "15": "Mediawijsheid",
    "16": "Wetenschapscompetenties",
}


def clean_text(value: Any) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def first_value(record: dict[str, Any], keys: Iterable[str]) -> Any:
    lowered = {str(key).casefold(): value for key, value in record.items()}
    for key in keys:
        value = lowered.get(key.casefold())
        if value not in (None, "", []):
            return value
    return None


def infer_finality(text: str) -> str:
    lowered = text.casefold()
    if "dubbele finaliteit" in lowered:
        return "dubbele finaliteit"
    if "finaliteit arbeidsmarkt" in lowered or "arbeidsmarktfinaliteit" in lowered:
        return "arbeidsmarktfinaliteit"
    if "finaliteit doorstroom" in lowered or "doorstroomfinaliteit" in lowered:
        return "doorstroomfinaliteit"
    return ""


def route_parts(*values: str) -> str:
    return " · ".join(value for value in values if value)


def normalize_minimum_goal_record(
    *,
    code: str,
    text: str,
    goal_type: str = "",
    grade: str = "",
    finality: str = "",
    stream: str = "",
    sc_nr: str = "",
    sc_name: str = "",
    source_url: str = "",
    source_label: str = "",
) -> dict[str, Any]:
    sc_label = sc_name or SC_LABELS.get(sc_nr, "")
    return build_secondary_record(
        code=code,
        text=text,
        goal_type=goal_type or source_label or "Onderwijsdoel secundair onderwijs",
        grade=grade,
        finality=finality,
        stream=stream,
        sc_name=sc_label,
        source_url=source_url,
    )


def normalize_api_goal(record: dict[str, Any]) -> dict[str, Any] | None:
    code = clean_text(
        first_value(
            record,
            (
                "uniqueCode",
                "uniekeCode",
                "code",
                "nummer",
                "onderwijsdoelCode",
            ),
        )
    )
    text = clean_text(
        first_value(
            record,
            (
                "title",
                "titel",
                "omschrijving",
                "tekst",
                "doelzin",
                "onderwijsdoel",
            ),
        )
    )
    if not code or len(text) < 12:
        return None

    level = clean_text(
        first_value(record, ("onderwijsniveau", "niveau", "educationLevel"))
    )
    combined = f"{level} {clean_text(record)}".casefold()
    if level and "secundair" not in combined:
        return None

    goal_type = clean_text(
        first_value(
            record,
            ("type", "doeltype", "onderwijsdoeltype", "goalType"),
        )
    )
    grade = clean_text(first_value(record, ("graad", "grade", "graadNaam")))
    finality = clean_text(
        first_value(record, ("finaliteit", "finality", "finaliteitNaam"))
    )
    stream = clean_text(first_value(record, ("stroom", "stream")))
    sc_name = clean_text(
        first_value(
            record,
            ("sleutelcompetentie", "keyCompetence", "competentie"),
        )
    )
    sc_nr = clean_text(first_value(record, ("sleutelcompetentie_nr", "sc_nr")))
    source_url = clean_text(
        first_value(record, ("url", "sourceUrl", "bronUrl", "detailUrl"))
    )

    return normalize_minimum_goal_record(
        code=code,
        text=text,
        goal_type=goal_type,
        grade=grade,
        finality=finality,
        stream=stream,
        sc_nr=sc_nr,
        sc_name=sc_name,
        source_url=source_url,
    )


def normalize_portal_goal(record: dict[str, Any]) -> dict[str, Any] | None:
    code = clean_text(record.get("code"))
    text = clean_text(record.get("omschrijving"))
    if not code or len(text) < 12:
        return None

    goal_type = clean_text(record.get("onderwijsdoel_type"))
    goal_set = record.get("onderwijsdoelenset")
    goal_set = goal_set if isinstance(goal_set, dict) else {}
    struct = goal_set.get("onderwijsstructuur")
    struct = struct if isinstance(struct, dict) else {}
    sc = goal_set.get("vlaamse_sleutelcompetentie")
    sc = sc if isinstance(sc, dict) else {}

    grade = clean_text(struct.get("graad"))
    stream = clean_text(struct.get("stroom"))
    leerjaar = clean_text(struct.get("leerjaar"))
    if leerjaar and leerjaar not in grade:
        grade = route_parts(grade, leerjaar)

    set_name = clean_text(goal_set.get("onderwijsdoelenset"))
    finality = infer_finality(set_name)
    sc_nr = clean_text(sc.get("nr"))
    sc_name = clean_text(sc.get("naam") or sc.get("korte_naam"))
    dataset = clean_text(record.get("_dataset"))
    source_url = (
        f"https://www.onderwijsdoelen.be/doelen/{dataset}"
        if dataset
        else "https://www.onderwijsdoelen.be/"
    )

    return normalize_minimum_goal_record(
        code=code,
        text=text,
        goal_type=goal_type,
        grade=grade,
        finality=finality,
        stream=stream,
        sc_nr=sc_nr,
        sc_name=sc_name,
        source_url=source_url,
        source_label=set_name,
    )


def walk_objects(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for nested in value.values():
            yield from walk_objects(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from walk_objects(nested)


def extract_api_goals(payloads: Iterable[Any]) -> list[dict[str, Any]]:
    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for payload in payloads:
        for record in walk_objects(payload):
            normalized = normalize_api_goal(record)
            if not normalized:
                continue
            unique.setdefault((normalized["code"], normalized["titel"]), normalized)
    return list(unique.values())


def extract_portal_goals(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[tuple[str, str, str], dict[str, Any]] = {}
    for record in records:
        normalized = normalize_portal_goal(record)
        if not normalized:
            continue
        key = (normalized["code"], normalized["titel"], normalized.get("graad", ""))
        unique.setdefault(key, normalized)
    return list(unique.values())
