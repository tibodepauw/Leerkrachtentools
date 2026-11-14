"""Bounded parsing of source documents in a separate process."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def parse_document(kind: str, path: Path, source: dict) -> list[dict]:
    # Package execution keeps this package's http.py out of sys.path[0], so
    # requests can import the standard-library http.client inside the worker.
    result = subprocess.run([sys.executable, "-m", "curriculum_pipeline.parser_worker"],
        cwd=Path(__file__).resolve().parents[1],
        input=json.dumps({"kind": kind, "path": str(path), "source": source}),
        text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=45,
        env={"PATH": os.defpath, "PYTHONUTF8": "1", "LANG": "C.UTF-8"})
    if result.returncode:
        raise RuntimeError("Bronparser is gestopt op een proces-, geheugen- of tijdgrens.")
    payload = json.loads(result.stdout)
    if payload.get("error"):
        raise RuntimeError(payload["error"])
    return payload["records"]


def check_zip(payload: bytes):
    from zipfile import ZipFile
    from io import BytesIO
    with ZipFile(BytesIO(payload)) as archive:
        entries = archive.infolist()
        if len(entries) > 2000 or sum(item.file_size for item in entries) > 128 * 1024 * 1024:
            raise ValueError("Bronarchief overschrijdt de uitgepakte grenzen.")
        if any(item.file_size > 32 * 1024 * 1024 for item in entries):
            raise ValueError("Een brononderdeel overschrijdt de uitgepakte grens.")


def old_go_rows(pages: list[str], source: dict) -> list[dict]:
    """GO! BaO tables have separate code, OD/ET, goal and year-matrix columns."""
    import re
    records = []
    current = None
    headings = {}

    def flush():
        nonlocal current
        if current and current.pop("_text"):
            text = " ".join(current.pop("_parts")).strip()
            if text:
                current["titel"] = re.sub(r"\s+", " ", text)
                records.append(current)
        current = None

    for page_number, page in enumerate(pages, start=1):
        lines = page.splitlines()
        header_index = next((index for index, line in enumerate(lines)
                             if "CODE" in line.upper() and "LEERPLANDOEL" in line.upper()), None)
        if header_index is None:
            continue
        header = lines[header_index].upper()
        heading_start = header.index("LEERPLANDOEL")
        text_start = max(0, heading_start - 2)
        minimum_start = next((header.index(label) for label in ["OD/ET", "OD / ET", "OD-ET", "ET"]
                              if label in header and header.index(label) < text_start), text_start)
        minimum_start = max(0, minimum_start - 2)
        matrix_start = 10000
        for line in lines[max(0, header_index - 2):header_index + 4]:
            positions = [match.start() for match in re.finditer(r"\bKO\b|\bLO\b|♣", line)]
            if positions and min(positions) > text_start + 15:
                matrix_start = min(matrix_start, min(positions) - 2)
        for line in lines[header_index + 1:]:
            if not line.strip() or re.fullmatch(r"[\s♣0-9]+", line):
                continue
            match = re.match(r"^\s*((?:\d+\.)+\s*\d+)(?=\s{2,}|$)", line)
            if match and match.start(1) >= minimum_start - 2:
                # Numeric OD/ET references in the middle column are not a new
                # curriculum goal, even when they occupy their own line.
                match = None
            code_text = line[:max(0, minimum_start - 2)].strip()
            code = re.sub(r"\s+", "", match[1]) if match else ""
            text = line[text_start:matrix_start].strip()
            rest = line[minimum_start:].strip()
            if re.fullmatch(r"\d+(?:\.\d+){1,5}", code) and rest and rest.isupper():
                flush()
                headings[code] = rest
                continue
            if code and (text or code.count(".") >= 3):
                flush()
                context = [value for prefix, value in headings.items() if code.startswith(prefix + ".")]
                current = {"code": code, "discipline": source["discipline"],
                    "subdomein": context[-1] if context else "", "onderwerp": context[-1] if context else "",
                    "netwerk": "GO_OUD", "onderwijsniveau": "Basisonderwijs",
                    "bron_url": source["url"], "bron_titel": source["title"],
                    "bron_context": context, "bron_paginas": [], "bron_rijen": [],
                    "bron_verwijzingen": [], "bron_leerjaarmatrix": [],
                    "bron_kolommen": {"minimum_start": minimum_start, "tekst_start": text_start,
                                      "leerjaren_start": matrix_start if matrix_start < 10000 else None},
                    "_parts": [], "_text": True}
            elif code_text:
                # A heading or a line outside the table is not goal continuation.
                continue
            if current:
                reference = line[minimum_start:text_start].strip()
                matrix = line[matrix_start:].strip() if matrix_start < 10000 else ""
                if text:
                    current["_parts"].append(text)
                if text or reference or matrix:
                    current["bron_rijen"].append(line.rstrip())
                    if page_number not in current["bron_paginas"]:
                        current["bron_paginas"].append(page_number)
                if reference:
                    current["bron_verwijzingen"].append(reference)
                if matrix:
                    current["bron_leerjaarmatrix"].append(matrix)
    flush()
    return records


def old_go_french(pages: list[str], source: dict) -> list[dict]:
    """French uses numbered goal cards followed by two columns of examples."""
    import re
    output, current = [], None

    def flush():
        nonlocal current
        if current:
            text = " ".join(current.pop("_parts")).strip()
            if not text:
                raise ValueError(f"Frans: doelkaart {current['code']} zonder leesbare doeltekst.")
            current["titel"] = re.sub(r"\s+", " ", text)
            output.append(current)
        current = None

    examples, divider = False, 90
    for page_number, page in enumerate(pages, start=1):
        lines = page.splitlines()
        if "leerplandoelstellingen" not in " ".join(lines[:5]).casefold():
            continue
        for line in lines[2:]:
            if "Voorbeelden van leerinhouden" in line:
                examples = True
                if "Specifieke" in line:
                    divider = line.index("Specifieke")
                continue
            match = re.match(r"^\s{0,7}(\d+\.\d+(?:\s+BIS)?)\s{2,}(.*)$", line)
            if match:
                flush()
                code = " ".join(match[1].split())
                current = {"code": code, "discipline": source["discipline"],
                    "netwerk": "GO_OUD", "onderwijsniveau": "Basisonderwijs",
                    "bron_url": source["url"], "bron_titel": source["title"],
                    "bron_paginas": [page_number], "bron_rijen": [line],
                    "voorbeelden": [], "didactische_wenken": [], "bron_context": [], "_parts": []}
                examples = False
                tail = match[2].strip()
                if tail:
                    current["bron_context" if tail.isupper() and not tail.startswith("DE LEERLINGEN") else "_parts"].append(tail)
                continue
            if not current or not line.strip():
                continue
            if page_number not in current["bron_paginas"]:
                current["bron_paginas"].append(page_number)
            current["bron_rijen"].append(line.rstrip())
            if examples:
                left, right = line[:divider].strip(), line[divider:].strip()
                if left:
                    current["voorbeelden"].append(left)
                if right:
                    current["didactische_wenken"].append(right)
            elif line.strip().isupper():
                current["bron_context"].append(line.strip())
                if line.strip().startswith("DE LEERLINGEN"):
                    current["_parts"].append(line.strip())
            else:
                current["_parts"].append(line.strip())
    flush()
    return output


def old_go_early_math(pages: list[str], source: dict) -> list[dict]:
    """The old kindergarten math source distinguishes goals with square symbols."""
    import re
    records, current, context = [], None, ""

    def flush():
        nonlocal current
        if current:
            current["titel"] = re.sub(r"\s+", " ", " ".join(current.pop("_parts"))).strip()
            if not current["titel"]:
                raise ValueError("Wiskundige initiatie: doelmarkering zonder tekst.")
            records.append(current)
        current = None

    for page_number, page in enumerate(pages, 1):
        examples = False
        for line in page.splitlines():
            if "Algemene doelstellingen" in line or line.strip() == "WIS/WI":
                continue
            heading = re.match(r"^\s*\d+\.\s{2,}([A-ZÀ-Ÿ][A-ZÀ-Ÿ\s-]+)$", line)
            if heading:
                flush()
                context = heading[1].strip()
                continue
            goal = re.match(r"^\s{0,7}(\d+(?:\.\d+)+)\.?\s+([■/]+)\s+(.*)$", line)
            if goal:
                flush()
                current = {"code": goal[1], "discipline": "Wiskunde", "onderwerp": context,
                           "subdomein": context, "netwerk": "GO_OUD", "onderwijsniveau": "KLEUTER",
                           "bron_url": source["url"], "bron_titel": source["title"],
                           "bron_paginas": [], "bron_rijen": [], "bron_markering": goal[2],
                           "voorbeelden": [], "_parts": [goal[3].strip()]}
                examples = False
            elif not current or not line.strip():
                continue
            elif "" in line or "" in line:
                examples = True
                current["voorbeelden"].append(line.strip())
            elif examples:
                current["voorbeelden"].append(line.strip())
            else:
                current["_parts"].append(line.strip())
            current["bron_rijen"].append(line.rstrip())
            if page_number not in current["bron_paginas"]:
                current["bron_paginas"].append(page_number)
    flush()
    return records
