"""Uniform JSONL-schema voor alle Vlaamse onderwijsdoelen-domeinen."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Iterable

from secondary_record_schema import (
    GCS_SEPARATOR,
    clean_text,
    format_gcs_paragraph,
    load_jsonl,
    write_gcs_txt,
)

EDUCATION_JSONL_FIELDS: tuple[str, ...] = (
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

ONDERWIJSNIVEAUS: frozenset[str] = frozenset(
    {
        "KLEUTER",
        "LAGER",
        "SECUNDAIR",
        "BUBAO",
        "BUSO",
        "OKAN",
        "DKO",
        "VOLWASSENEN",
        "HOGER",
    }
)


def infer_bubao_type(set_name: str) -> str:
    lowered = set_name.casefold()
    if "basisaanbod" in lowered:
        return "Basisaanbod"
    match = re.search(r"\btype\s*(\d+)\b", lowered)
    if match:
        return f"Type {match.group(1)}"
    return ""


def infer_buso_opleidingsvorm(struct: dict[str, Any], set_name: str = "") -> str:
    ov = clean_text(struct.get("opleidingsvorm", ""))
    if ov:
        match = re.search(r"(\d+)", ov)
        if match:
            return f"OV{match.group(1)}"
    lowered = set_name.casefold()
    for token in ("ov1", "ov2", "ov3", "ov4"):
        if token in lowered.replace(" ", ""):
            return token.upper()
    return ov


def infer_dko_discipline(set_name: str) -> str:
    lowered = set_name.casefold()
    for label in ("beeld", "muziek", "woordkunst", "drama", "dans"):
        if label in lowered:
            return label.capitalize() if label != "drama" else "Woordkunst-drama"
    return ""


def classify_domain(
    *,
    dataset: str = "",
    set_name: str = "",
    struct: dict[str, Any] | None = None,
) -> str:
    struct = struct or {}
    if dataset in {"OKAN_V1_0"} or re.search(
        r"\bokan\b|onthaalonderwijs|nieuwkom", set_name, re.I
    ):
        return "OKAN"

    niveau = clean_text(struct.get("onderwijsniveau", ""))
    soort = clean_text(struct.get("onderwijssoort", ""))
    sub = clean_text(struct.get("onderwijs_subniveau", ""))

    if niveau == "Deeltijds kunstonderwijs":
        return "DKO"
    if niveau == "Volwassenenonderwijs":
        return "VOLWASSENEN"
    if niveau == "Hoger onderwijs":
        return "HOGER"
    if niveau == "Basisonderwijs" and soort == "Buitengewoon":
        return "BUBAO"
    if niveau == "Secundair onderwijs" and soort == "Buitengewoon":
        ov = infer_buso_opleidingsvorm(struct, set_name)
        if ov == "OV4":
            return "SECUNDAIR"
        return "BUSO"
    if niveau == "Secundair onderwijs":
        return "SECUNDAIR"
    if niveau == "Basisonderwijs":
        if sub == "Kleuteronderwijs":
            return "KLEUTER"
        return "LAGER"
    return ""


def normalize_graad_from_struct(
    struct: dict[str, Any],
    domain: str,
    set_name: str = "",
) -> str:
    graad = clean_text(struct.get("graad", ""))
    if graad:
        if re.search(r"\b(?:1ste|eerste)\s+graad\b", graad, re.I):
            return "1ste graad"
        if re.search(r"\b(?:2de|tweede)\s+graad\b", graad, re.I):
            return "2de graad"
        if re.search(r"\b(?:3de|derde)\s+graad\b", graad, re.I):
            return "3de graad"
        if re.search(r"\b(?:4de|vierde)\s+graad\b", graad, re.I):
            return "4de graad"
        return graad

    sub = clean_text(struct.get("onderwijs_subniveau", ""))
    if domain == "BUBAO":
        bubao_type = infer_bubao_type(set_name)
        if bubao_type:
            return bubao_type
        if "Kleuter" in sub:
            return "Kleuteronderwijs"
        return sub or "Lager onderwijs"
    if domain == "BUSO":
        return infer_buso_opleidingsvorm(struct, set_name) or "BuSO"
    if domain == "VOLWASSENEN":
        return sub or "Volwassenenonderwijs"
    if domain == "HOGER":
        return sub or "Lerarenopleiding"
    if domain == "OKAN":
        return "OKAN"
    return sub or graad


def normalize_finaliteit_from_record(
    *,
    domain: str,
    goal_type: str,
    struct: dict[str, Any],
    set_name: str = "",
) -> str:
    if domain == "BUBAO":
        bubao_type = infer_bubao_type(set_name)
        return bubao_type or "Ontwikkelingsdoel"
    if domain == "OKAN":
        if re.search(r"nt2|tweede taal", set_name, re.I):
            return "NT2"
        return "Integratie"
    if domain == "BUSO":
        return infer_buso_opleidingsvorm(struct, set_name) or "BuSO"
    if domain == "DKO":
        return clean_text(goal_type) or "Kunstonderwijs"
    if domain == "VOLWASSENEN":
        sub_label = clean_text(struct.get("onderwijs_subniveau", "")) or "Basiseducatie"
        return sub_label
    if domain == "HOGER":
        return clean_text(goal_type) or "Basiscompetentie"
    stream = clean_text(struct.get("stroom", ""))
    if stream:
        return stream
    finality = clean_text(struct.get("finaliteit", ""))
    if finality:
        return finality
    return clean_text(goal_type)


def normalize_api_goal_record(
    raw: dict[str, Any],
    *,
    dataset: str = "",
    source_url: str = "",
) -> dict[str, str] | None:
    code = clean_text(raw.get("code"))
    titel = clean_text(raw.get("omschrijving"))
    titel = re.sub(r"<[^>]+>", " ", titel)
    titel = clean_text(titel)
    if not code or len(titel) < 8:
        return None

    goal_set = raw.get("onderwijsdoelenset")
    goal_set = goal_set if isinstance(goal_set, dict) else {}
    struct = goal_set.get("onderwijsstructuur")
    struct = struct if isinstance(struct, dict) else {}
    sc = goal_set.get("vlaamse_sleutelcompetentie")
    sc = sc if isinstance(sc, dict) else {}

    set_name = clean_text(goal_set.get("onderwijsdoelenset"))
    domain = classify_domain(dataset=dataset, set_name=set_name, struct=struct)
    if not domain:
        return None

    goal_type = clean_text(raw.get("onderwijsdoel_type"))
    toelichting = clean_text(raw.get("memorie") or raw.get("voetnoot"))
    toelichting = re.sub(r"<[^>]+>", " ", toelichting)
    toelichting = clean_text(toelichting) or goal_type

    discipline = clean_text(sc.get("naam") or sc.get("korte_naam"))
    if domain == "DKO" and not discipline:
        discipline = infer_dko_discipline(set_name)
    if not discipline:
        discipline = clean_text(set_name.split(" - ")[0] if set_name else "")

    ds = dataset or clean_text(raw.get("_dataset"))
    bron = source_url or (
        f"https://www.onderwijsdoelen.be/doelen/{ds}"
        if ds
        else "https://www.onderwijsdoelen.be/"
    )

    return {
        "code": code,
        "discipline": discipline,
        "graad": normalize_graad_from_struct(struct, domain, set_name),
        "finaliteit": normalize_finaliteit_from_record(
            domain=domain,
            goal_type=goal_type,
            struct=struct,
            set_name=set_name,
        ),
        "titel": titel,
        "toelichting": toelichting,
        "netwerk": "AHOVOKS",
        "onderwijsniveau": domain,
        "bron_url": bron,
    }


def export_domain_gcs(data_dir: Path, domain: str, filename: str) -> int:
    jsonl_path = data_dir / filename
    gcs_dir = data_dir / "gcs"
    records = load_jsonl(jsonl_path)
    return write_gcs_txt(gcs_dir / filename.replace(".jsonl", ".txt"), records)


def export_all_domain_gcs(root: Path | None = None) -> dict[str, int]:
    from onderwijsdoelen_datasets import DOMAIN_OUTPUT

    root = root or Path(__file__).resolve().parents[1] / "data"
    counts: dict[str, int] = {}
    for domain, meta in DOMAIN_OUTPUT.items():
        data_dir = root / meta["dir"]
        jsonl = data_dir / meta["jsonl"]
        if not jsonl.exists():
            counts[meta["gcs"]] = 0
            continue
        counts[meta["gcs"]] = export_domain_gcs(
            data_dir,
            domain,
            meta["jsonl"],
        )
    return counts
