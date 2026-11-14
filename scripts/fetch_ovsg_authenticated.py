#!/usr/bin/env python3
"""Explicit authenticated OVSG collection, separate from generic public crawling."""
import argparse
import hashlib
import json
import logging
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username-file", type=Path)
    parser.add_argument("--password-file", type=Path)
    parser.add_argument("--min-delay", type=float, default=3)
    parser.add_argument("--max-delay", type=float, default=7)
    parser.add_argument("--fresh", action="store_true")
    parser.add_argument("--offline", action="store_true", help="Herverwerk uitsluitend de bewaarde bronkopieën, zonder netwerk.")
    parser.add_argument("--cache-dir", type=Path, default=Path.home()/".cache/agent-werk/leerkrachtentools-corpus/ovsg-bao-2027")
    args = parser.parse_args()
    if args.fresh and args.offline:
        parser.error("Kies --fresh of --offline")
    if not args.offline and not (args.username_file and args.password_file):
        parser.error("Een online verzameling vereist --username-file en --password-file")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from curriculum_pipeline.ovsg_authenticated import AuthenticatedOVSGClient, collect_primary, EDITION, PARSER_VERSION
    from curriculum_pipeline.http import atomic_bytes
    from curriculum_pipeline.store import Catalog, refresh_lock, canonical
    root = Path(__file__).resolve().parents[1]/"data"
    stage = root/"corpus/ovsg-bao-2027-2028"
    stage.mkdir(parents=True, exist_ok=True, mode=0o700)
    def secret(path):
        with path.open() as handle:
            value = handle.read(1001).strip()
        if not value or len(value)>500 or any(char in value for char in "\r\n"):
            raise ValueError("Ongeldige inlogconfiguratie.")
        return value
    with refresh_lock(root/"corpus"):
        catalog = Catalog(root/"corpus", root)
        try:
            http = AuthenticatedOVSGClient(args.cache_dir,
                secret(args.username_file) if not args.offline else "",
                secret(args.password_file) if not args.offline else "",
                minimum=args.min_delay, maximum=args.max_delay, fresh=args.fresh,
                offline=args.offline, snapshot_lookup=catalog.source_snapshot)
            def progress(value):
                atomic_bytes(stage/"progress.json", (json.dumps(value, indent=2)+"\n").encode())
            rows, resources, inventory, entities = collect_primary(http, progress)
            catalog.archive_sources(resources)
            catalog.retain_source_records("OVSG_BAO_2027_2028", entities)
            digest = hashlib.sha256(canonical({"parser": PARSER_VERSION, "inventory": inventory}).encode()).hexdigest()
            coverage = {"complete": True, "edition": EDITION,
                    "fields": 9, "lines": len(inventory), "expected_goals": sum(i["expected"] for i in inventory),
                    "entities": len(entities), "scope": "Volledige aangeboden basisinventaris met relaties en differentiatie",
                    "media": "Oorspronkelijke HTML en mediareferenties bewaard; externe mediabestanden niet gekopieerd",
                    "access": "Expliciet gevraagde ingelogde accountverzameling, geen generieke publieke crawler"}
            if catalog.unchanged("OVSG_BAO_2027_2028", digest):
                if not catalog.verify("OVSG_BAO_2027_2028")["valid"]:
                    catalog.export("OVSG_BAO_2027_2028")
                catalog.confirm_unchanged("OVSG_BAO_2027_2028", resources)
                result = {"dataset": "OVSG_BAO_2027_2028", "status": "unchanged", "records": len(rows)}
            else:
                result = catalog.publish("OVSG_BAO_2027_2028", rows,
                    relative_path="ovsg/ovsg_2027_2028_volledig.jsonl", input_hash=digest,
                    resources=resources, coverage=coverage)
            atomic_bytes(stage/"inventory.json", (json.dumps(inventory, ensure_ascii=False, indent=2)+"\n").encode())
            atomic_bytes(stage/"result.json", (json.dumps(result, ensure_ascii=False, indent=2)+"\n").encode())
            progress({"edition": EDITION, "lines": len(inventory), "goals": len(rows),
                      "requests": http.metrics["requests"], "complete": True, "status": result["status"]})
            print(json.dumps(result, ensure_ascii=False))
        finally:
            catalog.close()


if __name__ == "__main__":
    try:
        main()
    except BlockingIOError:
        logging.error("Er draait al een corpusupdate. Deze tweede run is niet gestart.")
        raise SystemExit(2) from None
    except (OSError, ValueError, RuntimeError) as error:
        logging.error("OVSG-verzameling gestopt: %s", error)
        raise SystemExit(1) from None
