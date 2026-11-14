#!/usr/bin/env python3
"""Convert an official OVSG Excel selection to a local review file, without publication."""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-records", type=int)
    args = parser.parse_args(argv)
    if args.expected_records is not None and args.expected_records < 1:
        parser.error("--expected-records moet positief zijn")
    if args.output.resolve() == args.input.resolve() or args.output.suffix != ".jsonl":
        parser.error("Kies een afzonderlijk .jsonl-uitvoerbestand")
    data_root = (Path(__file__).resolve().parents[1] / "data").resolve()
    output = args.output.resolve()
    if output.is_relative_to(data_root) and not output.is_relative_to(data_root / "corpus"):
        parser.error("Een exportselectie mag geen actieve appdata vervangen; kies een uitvoerpad in data/corpus")
    from curriculum_pipeline.documents import parse_document
    from curriculum_pipeline.http import atomic_bytes
    from curriculum_pipeline.store import canonical, normalize

    def source_hash():
        with args.input.open("rb") as handle:
            data = handle.read(32 * 1024 * 1024 + 1)
        if len(data) > 32 * 1024 * 1024:
            raise ValueError("OVSG-export overschrijdt de invoergrens.")
        return hashlib.sha256(data).hexdigest()

    digest = source_hash()
    records = parse_document("ovsg_secondary_excel", args.input.resolve(), {"title": args.input.name})
    if source_hash() != digest:
        raise ValueError("De bron is gewijzigd tijdens verwerking.")
    if args.expected_records is not None and len(records) != args.expected_records:
        raise ValueError("Het aantal doelen wijkt af van de opgegeven selectie.")
    normalized = [normalize({**row, "bron_sha256": digest}, "OVSG_SECUNDAIR_SELECTIE") for row in records]
    report = {"records": len(normalized), "source_sha256": digest,
              "goal_types": dict(Counter(row["bron_doeltype"] for row in normalized)),
              "complete_collection": False, "published_to_app": False,
              "scope": "Officiële Excel-selectie, geen bewijs van volledige leerplandekking"}
    atomic_bytes(args.output, ("\n".join(canonical(row) for row in normalized) + "\n").encode())
    atomic_bytes(args.output.with_suffix(".report.json"), (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode())
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print(str(error))
        raise SystemExit(1) from None
