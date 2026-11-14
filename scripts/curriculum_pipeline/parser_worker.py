"""One source job per process, no inherited credentials or network client calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

if sys.platform != "win32":
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (30, 30))

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    from io import BytesIO
    from curriculum_pipeline.documents import check_zip, old_go_rows, old_go_french, old_go_early_math
    job = json.loads(sys.stdin.read(65537))
    path = Path(job["path"])
    if path.stat().st_size > 32 * 1024 * 1024:
        raise ValueError("Bronbestand overschrijdt de parsergrens.")
    payload, source = path.read_bytes(), job["source"]
    if job["kind"] == "ovsg_secondary_excel":
        from curriculum_pipeline.ovsg_export import parse_secondary_export
        records = parse_secondary_export(payload, source)
    elif job["kind"] == "go_new":
        check_zip(payload)
        from openpyxl import load_workbook
        from fetch_go_nieuw import GoNieuwFetcher
        workbook = load_workbook(BytesIO(payload), read_only=True, data_only=True)
        expected = sum(1 for sheet in workbook for row in sheet.iter_rows(min_row=2, values_only=True)
                       if row and str(row[0]).strip() == "doelzin")
        workbook.close()
        records = GoNieuwFetcher()._parse_excel_file(BytesIO(payload),
                    doelenset_nummer=int(source["doelenset_nummer"]), discipline=source["discipline"])
        if len(records) != expected or not records:
            raise ValueError("Niet alle doelzin-rijen uit het bronbestand zijn herkend.")
    elif job["kind"] == "go_old":
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(payload))
        if len(reader.pages) > 500:
            raise ValueError("Te veel bronpagina's voor één parserjob.")
        pages = [page.extract_text(extraction_mode="layout") for page in reader.pages]
        if sum(len(page.strip()) for page in pages) < 100:
            raise ValueError("Bron-PDF heeft geen bruikbare tekstlaag. Gecontroleerde OCR of een officiële tekstexport is nodig; geen onvolledige doelen gepubliceerd.")
        parser = old_go_rows
        if source.get("discipline", "").casefold() == "frans":
            parser = old_go_french
        elif "wiskundige initiatie" in source.get("title", "").casefold():
            parser = old_go_early_math
        records = parser(pages, source)
    else:
        from dataclasses import asdict
        from scrape_secondary_curricula import SourceDocument, parse_kov_docx, parse_pdf
        from secondary_record_schema import normalize_curriculum_record
        document = SourceDocument(**source)
        if job["kind"] == "secondary_docx":
            check_zip(payload)
            raw = parse_kov_docx(payload, document)
        elif job["kind"] == "secondary_pdf":
            from pypdf import PdfReader
            if len(PdfReader(BytesIO(payload)).pages) > 500:
                raise ValueError("Te veel bronpagina's voor één parserjob.")
            raw = parse_pdf(payload, document)
        else:
            raise ValueError("Onbekende bronparser.")
        records = [{**asdict(item), **normalize_curriculum_record(item)} for item in raw]
    return {"records": records}


if __name__ == "__main__":
    try:
        result = main()
        encoded = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode()) > 16 * 1024 * 1024:
            raise ValueError("Het geparste document overschrijdt de uitvoergrens.")
    except Exception as error:
        encoded = json.dumps({"error": str(error)[:500]})
    sys.stdout.write(encoded)
