#!/usr/bin/env python3
"""Manually refresh official curriculum data; never installs or schedules anything."""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from curriculum_pipeline.registry import DATASETS

ROOT = Path(__file__).resolve().parents[1]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datasets", nargs="+", choices=tuple(DATASETS), default=list(DATASETS))
    parser.add_argument("--data-root", type=Path, default=ROOT / "data")
    parser.add_argument("--cache-dir", type=Path,
                        default=Path.home() / ".cache/agent-werk/leerkrachtentools-corpus/http")
    parser.add_argument("--list", action="store_true", help="Show every dataset without network access.")
    parser.add_argument("--verify", action="store_true", help="Verify catalog and active exports without network access.")
    parser.add_argument("--export", action="store_true", help="Rebuild JSONL from the verified catalog, without scraping.")
    parser.add_argument("--offline", action="store_true", help="Reparse cached sources; never claims a new source check.")
    parser.add_argument("--resume", action="store_true", help="Reuse verified sources checked within the last hour; fetch missing sources.")
    parser.add_argument("--max-requests", type=int, default=5000)
    parser.add_argument("--domains-only", action="store_true")
    parser.add_argument("--skip-secundair", action="store_true")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)
    if args.max_requests < 1:
        parser.error("--max-requests moet positief zijn")
    if args.offline and args.resume:
        parser.error("Kies --offline of --resume")
    selected = [DATASETS[key] for key in dict.fromkeys(args.datasets)]
    if args.domains_only:
        selected = [item for item in selected if item.id in {"OKAN", "BUBAO", "BUSO", "DKO", "VOLWASSENEN", "HOGER"}]
    if args.skip_secundair:
        selected = [item for item in selected if item.id not in {"SECUNDAIR_LEERPLANNEN", "SECUNDAIR_MINIMUMDOELEN", "POV"}]
    if args.list:
        for item in selected:
            print(f"{item.id}: {item.path} | {item.source_url}")
        return 0

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(levelname)s %(message)s")
    from local_env import load_local_env
    load_local_env(ROOT)
    from curriculum_pipeline.http import HttpCache, SourceBlocked, atomic_bytes, now
    from curriculum_pipeline.store import Catalog, refresh_lock
    from curriculum_pipeline.registry import HOSTS
    from curriculum_pipeline.adapters import collect, IncompleteSource
    state_root = args.data_root / "corpus"
    try:
        with refresh_lock(state_root):
            catalog = Catalog(state_root, args.data_root)
            http = HttpCache(args.cache_dir, HOSTS, offline=args.offline, request_limit=args.max_requests,
                             recent_seconds=3600 if args.resume else 0, snapshot_lookup=catalog.source_snapshot)
            results = []
            try:
                for dataset in selected:
                    try:
                        if args.export:
                            catalog.export(dataset.id)
                        if not (args.verify or args.export) and dataset.adapter == "ovsg_authenticated":
                            # Account collection is a separate explicit command. A
                            # public refresh must not invalidate its last good state.
                            state = catalog.state(dataset.id)
                            results.append({"dataset": dataset.id, "status": "manual_refresh_required",
                                "records": state["record_count"] if state else 0,
                                "detail": "Gebruik de afzonderlijke fetch:ovsg- of fetch:ovsg-secundair-ingang met beveiligde credentialbestanden."})
                            continue
                        if args.verify or args.export:
                            result = catalog.verify(dataset.id)
                            result["status"] = "ready" if result.get("valid") and result.get("status") == "ready" else "incomplete"
                        else:
                            logging.info("Bron controleren: %s", dataset.id)
                            harvest = collect(dataset, http)
                            catalog.archive_sources(harvest.resources)
                            atomic_bytes(state_root / "inventories" / (dataset.id + ".json"),
                                (json.dumps({"dataset": dataset.id, "coverage": harvest.coverage,
                                  "inventory": harvest.inventory,
                                  "sources": [{"url": item.url, "sha256": item.sha256,
                                               "checked_at": item.metadata["checked_at"]} for item in harvest.resources]},
                                  ensure_ascii=False, indent=2) + "\n").encode())
                            if hasattr(http, "education_raw_rows") and not getattr(http, "education_rows_saved", False):
                                catalog.retain_source_records("AHOVOKS", http.education_raw_rows)
                                http.education_rows_saved = True
                            signature = harvest.signature()
                            if catalog.unchanged(dataset.id, signature):
                                if not catalog.verify(dataset.id)["valid"]:
                                    catalog.export(dataset.id)
                                catalog.confirm_unchanged(dataset.id, harvest.resources)
                                result = {"dataset": dataset.id, "status": "unchanged",
                                          "records": catalog.state(dataset.id)["record_count"]}
                            else:
                                result = catalog.publish(dataset.id, harvest.parse(),
                                    relative_path=dataset.path, input_hash=signature,
                                    coverage=harvest.coverage, resources=harvest.resources)
                        results.append(result)
                    except Exception as error:
                        # Also retain successfully retrieved artifacts when a later
                        # source page or parser prevents complete publication.
                        try:
                            catalog.archive_sources(http.used.values())
                        except Exception:
                            logging.warning("Niet alle ruwe bronkopieën konden duurzaam worden bewaard.")
                        status = "blocked" if isinstance(error, SourceBlocked) else "incomplete" if isinstance(error, IncompleteSource) else "failed"
                        detail = str(error)[:1000]
                        catalog.failed(dataset.id, status, detail)
                        results.append({"dataset": dataset.id, "status": status, "detail": detail})
                        logging.warning("%s: %s", dataset.id, detail)
                report = {"schema_version": 1, "generated_at": now(), "manual_only": True,
                          "offline": args.offline, "resume": args.resume, "selected": [item.id for item in selected],
                          "results": results, "http": http.metrics,
                          "datasets": {key: catalog.state(key) or {"id": key, "status": "never_checked"} for key in DATASETS}}
                atomic_bytes(state_root / "manifest.json", (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode())
                for row in results:
                    print(f"{row['dataset']}: {row['status']} | {row.get('records', 0)} doelen")
                print(f"{len(selected)} geselecteerd uit {len(DATASETS)} datasets. Rapport: {state_root / 'manifest.json'}")
                return 0 if all(row["status"] in {"ready", "unchanged"} for row in results) else 1
            finally:
                catalog.close()
    except BlockingIOError:
        print("Er draait al een corpusupdate. Deze tweede run is niet gestart.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
