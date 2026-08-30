"""Gedeeld datamodel en GCS-export voor secundair onderwijs (JSONL + Discovery Engine)."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable

SECONDARY_JSONL_FIELDS: tuple[str, ...] = (
    "code",
    "discipline",
    "graad",
    "finaliteit",
    "titel",
    "toelichting",
    "netwerk",
    "onderwijsniveau",
    "bron_url",
)

GRADEN: frozenset[str] = frozenset(
    {
        "1ste graad",
        "2de graad",
        "3de graad",
        "7de specialisatiejaar",
    }
)

FINALITEITEN: frozenset[str] = frozenset(
    {
        "Doorstroom",
        "Dubbele finaliteit",
        "Arbeidsmarkt",
        "A-stroom",
        "B-stroom",
    }
)

NETWERKEN: frozenset[str] = frozenset({"KOV", "GO", "OVSG", "POV"})

GCS_CURRICULUM_FILES: dict[str, str] = {
    "KOV": "leerplannen_secundair_kov.txt",
    "GO": "leerplannen_secundair_go.txt",
    "OVSG": "leerplannen_secundair_ovsg.txt",
}
GCS_MINIMUM_FILE = "minimumdoelen_secundair.txt"
GCS_SEPARATOR = "---"


def clean_text(value: Any) -> str:
    text = str(value or "")
    return re.sub(r"\s+", " ", text).strip()


def normalize_graad(value: str) -> str:
    lowered = clean_text(value).casefold()
    if not lowered:
        return ""
    if re.search(r"\b(?:1ste|eerste)\s+graad\b", lowered):
        return "1ste graad"
    if re.search(r"\b(?:2de|tweede)\s+graad\b", lowered):
        return "2de graad"
    if re.search(r"\b(?:3de|derde)\s+graad\b", lowered):
        return "3de graad"
    if re.search(r"\b(?:7de|zevende)\s+(?:specialisatie(?:jaar)?|leerjaar|jaar)\b", lowered):
        return "7de specialisatiejaar"
    if lowered in GRADEN:
        return lowered
    return clean_text(value)


def normalize_finaliteit(finality: str = "", stream: str = "") -> str:
    stream_value = clean_text(stream)
    if stream_value.casefold() in {"a-stroom", "b-stroom"}:
        return "A-stroom" if stream_value.casefold() == "a-stroom" else "B-stroom"

    lowered = clean_text(finality).casefold()
    if not lowered:
        return ""
    if "a-stroom" in lowered and "b-stroom" not in lowered:
        return "A-stroom"
    if "b-stroom" in lowered:
        return "B-stroom"
    if "dubbele finaliteit" in lowered:
        return "Dubbele finaliteit"
    if "arbeidsmarkt" in lowered:
        return "Arbeidsmarkt"
    if "doorstroom" in lowered:
        return "Doorstroom"
    if finality in FINALITEITEN:
        return finality
    return ""


def normalize_netwerk(value: str) -> str:
    netwerk = clean_text(value).upper()
    if netwerk in NETWERKEN:
        return netwerk
    return ""


def _record_as_dict(record: Any) -> dict[str, Any]:
    if is_dataclass(record):
        return asdict(record)
    if isinstance(record, dict):
        return dict(record)
    raise TypeError(f"Onverwacht recordtype: {type(record)!r}")


def normalize_curriculum_record(record: Any) -> dict[str, str]:
    data = _record_as_dict(record)
    graad = normalize_graad(data.get("graad", ""))
    if not graad and data.get("leerjaar_route"):
        graad = normalize_graad(str(data.get("leerjaar_route", "")))

    finaliteit = normalize_finaliteit(
        str(data.get("finaliteit", "")),
        str(data.get("stroom", "")),
    )
    if not finaliteit and data.get("leerjaar_route"):
        route = str(data.get("leerjaar_route", ""))
        finaliteit = normalize_finaliteit(route, route)

    return {
        "code": clean_text(data.get("code", "")),
        "discipline": clean_text(data.get("discipline", "")),
        "graad": graad,
        "finaliteit": finaliteit,
        "titel": clean_text(data.get("titel", "")),
        "toelichting": clean_text(data.get("toelichting", "")),
        "netwerk": normalize_netwerk(str(data.get("netwerk", ""))),
        "onderwijsniveau": "SECUNDAIR",
        "bron_url": clean_text(data.get("bron_url", "")),
    }


def normalize_minimum_goal_record(
    *,
    code: str,
    text: str,
    goal_type: str = "",
    grade: str = "",
    finality: str = "",
    stream: str = "",
    sc_name: str = "",
    source_url: str = "",
) -> dict[str, str]:
    return {
        "code": clean_text(code),
        "discipline": clean_text(sc_name),
        "graad": normalize_graad(grade),
        "finaliteit": normalize_finaliteit(finality, stream),
        "titel": clean_text(text),
        "toelichting": clean_text(goal_type),
        "netwerk": "",
        "onderwijsniveau": "SECUNDAIR",
        "bron_url": clean_text(source_url) or "https://www.onderwijsdoelen.be/",
    }


def validate_secondary_record(record: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    for field in SECONDARY_JSONL_FIELDS:
        if field not in record:
            issues.append(f"Ontbrekend veld: {field}")
    if record.get("onderwijsniveau") != "SECUNDAIR":
        issues.append("onderwijsniveau moet SECUNDAIR zijn")
    graad = record.get("graad", "")
    if graad and graad not in GRADEN:
        issues.append(f"Ongeldige graad: {graad}")
    finaliteit = record.get("finaliteit", "")
    if finaliteit and finaliteit not in FINALITEITEN:
        issues.append(f"Ongeldige finaliteit: {finaliteit}")
    netwerk = record.get("netwerk", "")
    if netwerk and netwerk not in NETWERKEN:
        issues.append(f"Ongeldig netwerk: {netwerk}")
    if not clean_text(record.get("titel", "")):
        issues.append("titel ontbreekt")
    return issues


def format_gcs_paragraph(record: dict[str, Any]) -> str:
    lines: list[str] = []
    code = clean_text(record.get("code"))
    discipline = clean_text(record.get("discipline"))
    graad = clean_text(record.get("graad"))
    finaliteit = clean_text(record.get("finaliteit"))
    titel = clean_text(record.get("titel"))
    toelichting = clean_text(record.get("toelichting"))
    bron_url = clean_text(record.get("bron_url"))

    if code:
        lines.append(f"Doelcode: {code}")
    if discipline:
        lines.append(f"Vak: {discipline}")
    if graad:
        lines.append(f"Graad: {graad}")
    if finaliteit:
        lines.append(f"Finaliteit: {finaliteit}")
    if titel:
        lines.append(f"Doelstelling: {titel}")
    if toelichting:
        lines.append(f"Toelichting: {toelichting}")
    if bron_url:
        lines.append(f"Bron: {bron_url}")
    return "\n".join(lines)


def normalize_minimum_from_jsonl(record: dict[str, Any]) -> dict[str, str]:
    linked = record.get("gelinkt_minimumdoel")
    if isinstance(linked, dict):
        return normalize_minimum_goal_record(
            code=str(linked.get("code", "")),
            text=str(linked.get("tekst", "")),
            goal_type=str(linked.get("type", "")),
            grade=str(record.get("graad", "")),
            finality=str(record.get("finaliteit", "")),
            stream=str(record.get("stroom", "")),
            sc_name=str(record.get("discipline") or record.get("sleutelcompetentie", "")),
            source_url=str(record.get("bron_url", "")),
        )

    normalized = {
        field: clean_text(record.get(field, "")) for field in SECONDARY_JSONL_FIELDS
    }
    if not normalized["onderwijsniveau"]:
        normalized["onderwijsniveau"] = "SECUNDAIR"
    normalized["graad"] = normalize_graad(normalized["graad"])
    normalized["finaliteit"] = normalize_finaliteit(normalized["finaliteit"])
    return normalized


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped:
            records.append(json.loads(stripped))
    return records


def write_gcs_txt(path: Path, records: Iterable[dict[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    paragraphs = [
        paragraph
        for record in records
        if (paragraph := format_gcs_paragraph(record))
    ]
    content = f"\n{GCS_SEPARATOR}\n".join(paragraphs)
    if content:
        content += f"\n{GCS_SEPARATOR}\n"
    path.write_text(content, encoding="utf-8")
    return len(paragraphs)


def export_secundair_gcs(
    data_dir: Path | None = None,
    output_dir: Path | None = None,
) -> dict[str, int]:
    root = Path(__file__).resolve().parents[1]
    data_dir = data_dir or root / "data" / "secundair"
    output_dir = output_dir or data_dir / "gcs"

    curriculum_path = data_dir / "leerplannen_secundair.jsonl"
    minimum_path = data_dir / "minimumdoelen_secundair.jsonl"

    curriculum = [
        normalize_curriculum_record(record) for record in load_jsonl(curriculum_path)
    ]
    minimum = [
        normalize_minimum_from_jsonl(record) for record in load_jsonl(minimum_path)
    ]

    counts: dict[str, int] = {}
    for netwerk, filename in GCS_CURRICULUM_FILES.items():
        network_records = [record for record in curriculum if record.get("netwerk") == netwerk]
        counts[filename] = write_gcs_txt(output_dir / filename, network_records)

    counts[GCS_MINIMUM_FILE] = write_gcs_txt(output_dir / GCS_MINIMUM_FILE, minimum)
    return counts
