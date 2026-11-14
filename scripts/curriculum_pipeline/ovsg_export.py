"""Read the official secondary Excel selection without claiming full coverage."""
import re
from io import BytesIO

from .documents import check_zip

REQUIRED_COLUMNS = ("doeltype", "code", "omschrijving", "leerlijn", "indeling", "leerplan")
EXPORT_URL = "https://leerlokaal.ovsg.be/so/doelenkiezer/exporteer/excel"


def parse_secondary_export(payload: bytes, source: dict) -> list[dict]:
    from openpyxl import load_workbook
    check_zip(payload)
    workbook = load_workbook(BytesIO(payload), read_only=True, data_only=False)
    records, identities = [], set()
    try:
        if workbook.sheetnames != ["Doelen"]:
            raise ValueError("OVSG-export heeft niet het verwachte werkblad Doelen.")
        sheet = workbook["Doelen"]
        rows = sheet.iter_rows()
        header_cells = next(rows, ())
        headers = [cell.value for cell in header_cells]
        if not headers or not all(isinstance(value, str) and value.strip() for value in headers):
            raise ValueError("OVSG-export heeft ongeldige kolomkoppen.")
        keys = [value.strip().casefold() for value in headers]
        if len(set(keys)) != len(keys) or any(key not in keys for key in REQUIRED_COLUMNS):
            raise ValueError("OVSG-export mist verplichte of bevat dubbele kolommen.")
        for number, cells in enumerate(rows, 2):
            if all(cell.value is None for cell in cells):
                continue
            if any(cell.data_type == "f" for cell in cells):
                raise ValueError("OVSG-export bevat een formule; bronwaarden niet stilzwijgend vervangen.")
            values = [cell.value for cell in cells]
            if any(value is not None and not isinstance(value, (str, int, float, bool)) for value in values):
                raise ValueError("OVSG-export bevat een niet ondersteund celtype.")
            raw = dict(zip(headers, values, strict=True))
            row = dict(zip(keys, values, strict=True))
            if not all(isinstance(row[key], str) and row[key].strip() for key in REQUIRED_COLUMNS):
                raise ValueError(f"OVSG-export bevat een onvolledige doelrij op regel {number}.")
            code, plan = row["code"].strip(), row["leerplan"].strip()
            stream = re.match(r"^([AB])\s+", code)
            if not stream or not re.search(r"\beerste graad\b", plan, re.I):
                raise ValueError("OVSG-export bevat een nog niet ondersteunde onderwijscontext.")
            identity = (code, plan, row["leerlijn"], row["indeling"])
            if identity in identities:
                raise ValueError("OVSG-export bevat een herhaalde doelidentiteit.")
            identities.add(identity)
            records.append({"code": code, "titel": row["omschrijving"].strip(),
                "discipline": row["indeling"].split(":", 1)[-1].strip(),
                "subdomein": row["leerlijn"].strip(), "toelichting": row["doeltype"].strip(),
                "netwerk": "OVSG", "onderwijsniveau": "SECUNDAIR", "graad": "1ste graad",
                "stroom": stream[1] + "-stroom", "finaliteit": stream[1] + "-stroom",
                "leerjaar_route": "1ste graad · " + stream[1] + "-stroom",
                "bron_url": EXPORT_URL, "bron_titel": source["title"],
                "bron_werkblad": "Doelen", "bron_rij": number,
                "bron_doeltype": row["doeltype"], "bron_leerplan": plan,
                "bron_veldwaarden": raw, "bron_omvang": "exportselectie; volledige collectiedekking niet bewezen"})
        if not records:
            raise ValueError("OVSG-export bevat geen doelen.")
        return records
    finally:
        workbook.close()
