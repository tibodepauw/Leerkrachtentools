#!/usr/bin/env python3
"""Collect the complete offered secondary account inventory for local verification."""
import argparse
import json
import logging
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username-file", type=Path)
    parser.add_argument("--password-file", type=Path)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--fresh", action="store_true")
    parser.add_argument("--publish", action="store_true", help="Publiceer uitsluitend na volledige inventariscontrole naar de aparte secundaire OVSG-dataset.")
    parser.add_argument("--cache-dir", type=Path, default=Path.home()/".cache/agent-werk/leerkrachtentools-corpus/ovsg-secundair")
    args = parser.parse_args()
    if args.offline and args.fresh:
        parser.error("Kies --offline of --fresh")
    if not args.offline and not (args.username_file and args.password_file):
        parser.error("Een online verzameling vereist beveiligde credentialbestanden")
    from curriculum_pipeline.ovsg_secondary_authenticated import SecondaryOVSGClient, collect_secondary, DATASET, PARSER_VERSION
    import hashlib
    from curriculum_pipeline.http import atomic_bytes
    from curriculum_pipeline.store import Catalog, refresh_lock, canonical
    root = Path(__file__).resolve().parents[1]/"data"
    stage = root/"corpus/ovsg-secundair"
    def secret(path):
        with path.open() as handle:
            value = handle.read(1001).strip()
        if not value or len(value)>500 or any(c in value for c in "\r\n"):
            raise ValueError("Ongeldige inlogconfiguratie")
        return value
    with refresh_lock(root/"corpus"):
        catalog = Catalog(root/"corpus",root)
        try:
            http = SecondaryOVSGClient(args.cache_dir,
                secret(args.username_file) if not args.offline else "",
                secret(args.password_file) if not args.offline else "",
                offline=args.offline, fresh=args.fresh, snapshot_lookup=catalog.source_snapshot)
            def progress(value):
                atomic_bytes(stage/"progress.json",(json.dumps(value,indent=2)+"\n").encode())
            rows,resources,inventory,entities = collect_secondary(http,progress)
            catalog.archive_sources(resources)
            catalog.retain_source_records(DATASET,entities)
            atomic_bytes(stage/"candidate.jsonl",("\n".join(canonical(r) for r in rows)+"\n").encode())
            atomic_bytes(stage/"inventory.json",(json.dumps(inventory,ensure_ascii=False,indent=2)+"\n").encode())
            result = {"dataset":DATASET,"goals":len(rows),"lines":len(inventory),"sources":len(resources),
                      "requests":http.metrics["requests"],"complete":True,"published_to_app":False}
            if args.publish:
                digest=hashlib.sha256(canonical({"parser":PARSER_VERSION,"inventory":inventory}).encode()).hexdigest()
                if catalog.unchanged(DATASET,digest):
                    if not catalog.verify(DATASET)["valid"]:catalog.export(DATASET)
                    catalog.confirm_unchanged(DATASET,resources)
                    published={"dataset":DATASET,"status":"unchanged","records":len(rows)}
                else:
                    published=catalog.publish(DATASET,rows,relative_path="secundair/leerplannen_ovsg_2025.jsonl",
                        input_hash=digest,resources=resources,coverage={"complete":True,"edition":"2025",
                            "plans":5,"lines":len(inventory),"scope":"Alle vijf aangeboden eerste-graadleerplannen; volledige broncontext apart bewaard",
                            "media":"HTML en referenties bewaard; externe media niet afzonderlijk gekopieerd"})
                result.update(published,published_to_app=True)
            progress(result)
            print(json.dumps(result))
        finally:
            catalog.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,format="%(levelname)s %(message)s")
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        logging.error("Secundaire verzameling gestopt: %s",error)
        raise SystemExit(1) from None
