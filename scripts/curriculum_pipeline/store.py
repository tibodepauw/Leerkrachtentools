"""Canonical SQLite catalog with validated, compact app-compatible JSONL exports."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .http import atomic_bytes, now

SCHEMA_VERSION = 1


def canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def normalize(record: dict, dataset: str) -> dict:
    if not isinstance(record, dict):
        raise ValueError("Een doelrecord moet een object zijn.")
    code = record.get("code")
    title = record.get("titel")
    if not isinstance(code, str) or not code.strip() or not isinstance(title, str) or not title.strip():
        raise ValueError("Een doelrecord heeft een broncode en doeltekst nodig.")
    source = record.get("bron_url")
    if not isinstance(source, str) or not source.startswith("https://"):
        raise ValueError("Elk doel moet naar zijn echte HTTPS-bron verwijzen.")
    identity = {"dataset": dataset, **{key: record.get(key) for key in (
        "code", "netwerk", "bron_url", "onderwijsniveau", "graad", "finaliteit", "stroom",
        "leerjaar_route", "leerjaren", "component", "discipline", "subdomein", "onderwerp",
        "onderwijsdoelenset", "onderwijsdoel_type", "_dataset", "bron_id",
        "bron_werkblad",
    )}}
    if record.get("bron_id") is not None:
        goal_set = record.get("onderwijsdoelenset") or {}
        validity = record.get("geldigheid") or {}
        identity = {"dataset": dataset, "source_id": record["bron_id"],
                    "source_url": source, "source_set": goal_set.get("onderwijsdoelenset_id", goal_set),
                    "title_context": record.get("titels"),
                    "valid_from": validity.get("geldig_van_dt"), "valid_until": validity.get("geldig_tot_dt"),
                    "goal_type": record.get("onderwijsdoel_type")}
    identifier = hashlib.sha256(canonical(identity).encode()).hexdigest()
    # Preserve every provider-specific field; the raw source remains in the HTTP cache.
    result = {**record, "code": code.strip(), "titel": title.strip(),
              "corpus_id": identifier, "corpus_dataset": dataset, "schema_version": SCHEMA_VERSION}
    if len(canonical(result).encode()) > 1_048_576:
        raise ValueError("Doelrecord overschrijdt de appgrens van 1 MiB.")
    return result


@contextmanager
def refresh_lock(root: Path):
    """OS lock, released even after a killed process. No stale PID guessing."""
    root.mkdir(parents=True, exist_ok=True)
    with (root / "refresh.lock").open("a+b") as handle:
        if os.name == "nt":
            import msvcrt
            handle.write(b"0")
            handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


class Catalog:
    def __init__(self, root: Path, data_root: Path):
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        root.chmod(0o700)
        self.root, self.data_root = root, data_root
        self.archived_hashes = set()
        self.db = sqlite3.connect(root / "catalog.sqlite3")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY, input_hash TEXT, content_hash TEXT,
                record_count INTEGER NOT NULL DEFAULT 0, checked_at TEXT,
                succeeded_at TEXT, status TEXT NOT NULL, detail TEXT NOT NULL,
                coverage TEXT NOT NULL, export_path TEXT);
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY, dataset TEXT NOT NULL REFERENCES datasets(id),
                code TEXT NOT NULL, title TEXT NOT NULL, network TEXT NOT NULL,
                education_level TEXT NOT NULL, payload TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS goals_dataset_code ON goals(dataset,code);
            CREATE VIRTUAL TABLE IF NOT EXISTS goal_search USING fts5(id UNINDEXED,code,title);
            CREATE TABLE IF NOT EXISTS sources (
                dataset TEXT NOT NULL REFERENCES datasets(id), url TEXT NOT NULL,
                sha256 TEXT NOT NULL, metadata TEXT NOT NULL,
                PRIMARY KEY(dataset,url));
            CREATE TABLE IF NOT EXISTS source_records (
                family TEXT NOT NULL, id TEXT NOT NULL, domain TEXT NOT NULL,
                validity TEXT NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(family,id));
            CREATE INDEX IF NOT EXISTS source_records_scope ON source_records(family,domain,validity);
            CREATE TABLE IF NOT EXISTS source_artifacts (
                url TEXT NOT NULL, sha256 TEXT NOT NULL, metadata TEXT NOT NULL,
                PRIMARY KEY(url,sha256));
        """)
        # Additive migration for catalogs created by an earlier updater version.
        for table, column in (("datasets", "last_attempt_at"), ("source_records", "source_url"),
                              ("source_records", "source_sha256")):
            if column not in {row[1] for row in self.db.execute(f"PRAGMA table_info({table})")}:
                self.db.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT")
        self.db.commit()

    def close(self):
        self.db.close()

    def archive_sources(self, resources):
        """Final source artifacts outlive the disposable HTTP download cache."""
        with self.db:
            for resource in resources:
                target = self.root / "sources" / (resource.sha256 + ".gz")
                valid = resource.sha256 in self.archived_hashes
                if not valid and target.exists():
                    try:
                        with gzip.open(target, "rb") as handle:
                            restored = handle.read(32 * 1024 * 1024 + 1)
                        valid = hashlib.sha256(restored).hexdigest() == resource.sha256
                    except (OSError, EOFError):
                        valid = False
                if not valid:
                    data = resource.content
                    if hashlib.sha256(data).hexdigest() != resource.sha256:
                        raise ValueError("Bronkopie wijkt af van haar gecontroleerde hash.")
                    atomic_bytes(target, gzip.compress(data, compresslevel=6, mtime=0))
                self.archived_hashes.add(resource.sha256)
                legacy = self.root / "sources" / resource.sha256
                if legacy.is_file() and hashlib.sha256(legacy.read_bytes()).hexdigest() == resource.sha256:
                    # Remove only a byte-identical earlier copy after its durable
                    # lossless compressed replacement has been verified.
                    legacy.unlink()
                self.db.execute("INSERT OR REPLACE INTO source_artifacts VALUES (?,?,?)",
                                (resource.url, resource.sha256, canonical(resource.metadata)))

    def retain_source_records(self, family: str, rows: list[dict]):
        """Complete source snapshot, including inactive and unresolved validity."""
        if not rows or len({row["id"] for row in rows}) != len(rows):
            raise ValueError("Onvolledige of botsende ruwe bronrecords.")
        with self.db:
            self.db.execute("DELETE FROM source_records WHERE family=?", (family,))
            self.db.executemany("INSERT INTO source_records(family,id,domain,validity,payload,source_url,source_sha256) VALUES (?,?,?,?,?,?,?)", [
                (family,row["id"],row["domain"],row["validity"],canonical(row["payload"]),
                 row.get("source_url"),row.get("source_sha256")) for row in rows])

    def source_snapshot(self, url: str):
        """Restore the latest checked original bytes without an HTTP cache."""
        row = self.db.execute("""SELECT sha256,metadata FROM source_artifacts WHERE url=?
            ORDER BY json_extract(metadata,'$.checked_at') DESC LIMIT 1""", (url,)).fetchone()
        if row is None:
            return None
        digest, encoded = row
        if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
            raise ValueError("Ongeldige bronhash in de catalogus.")
        with gzip.open(self.root / "sources" / (digest + ".gz"), "rb") as handle:
            data = handle.read(32 * 1024 * 1024 + 1)
        if len(data) > 32 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != digest:
            raise ValueError("Duurzaam bronarchief wijkt af van zijn gecontroleerde hash.")
        return data, json.loads(encoded)

    def state(self, dataset: str) -> dict | None:
        self.db.row_factory = sqlite3.Row
        row = self.db.execute("SELECT * FROM datasets WHERE id=?", (dataset,)).fetchone()
        if row is None:
            return None
        result = dict(row)
        result["coverage"] = json.loads(result["coverage"])
        return result

    def failed(self, dataset: str, status: str, detail: str):
        if status not in {"blocked", "failed", "incomplete"}:
            raise ValueError("Ongeldige foutstatus.")
        with self.db:
            self.db.execute("""INSERT INTO datasets(id,status,detail,coverage,last_attempt_at)
                VALUES (?,?,?,'{}',?) ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,detail=excluded.detail,last_attempt_at=excluded.last_attempt_at""",
                (dataset, status, detail[:1000], now()))

    def unchanged(self, dataset: str, input_hash: str) -> bool:
        previous = self.state(dataset)
        return bool(previous and previous["input_hash"] == input_hash and previous["record_count"] > 0)

    def confirm_unchanged(self, dataset: str, resources: list) -> None:
        checked_at = min((item.metadata["checked_at"] for item in resources), default=now())
        with self.db:
            self.db.execute("UPDATE datasets SET checked_at=?,last_attempt_at=?,status='ready',detail='' WHERE id=?", (checked_at, now(), dataset))
            self._sources(dataset, resources)

    def _sources(self, dataset: str, resources: list):
        self.db.execute("DELETE FROM sources WHERE dataset=?", (dataset,))
        for resource in resources:
            self.db.execute("INSERT INTO sources VALUES (?,?,?,?)",
                            (dataset, resource.url, resource.sha256, canonical(resource.metadata)))

    def publish(self, dataset: str, records: list[dict], *, relative_path: str,
                input_hash: str, coverage: dict, resources: list):
        if coverage.get("complete") is not True:
            raise ValueError("Onvolledige broninventaris mag het actieve corpus niet vervangen.")
        if not records:
            raise ValueError("Een leeg corpus mag de laatste geldige versie niet vervangen.")
        rows: dict[str, dict] = {}
        for raw in records:
            item = normalize(raw, dataset)
            key = item["corpus_id"]
            if key in rows and canonical(rows[key]) != canonical(item):
                raise ValueError("Botsende doelidentiteit: context mag niet stilzwijgend verdwijnen.")
            rows[key] = item
        items = sorted(rows.values(), key=lambda row: row["corpus_id"])
        data = ("\n".join(canonical(row) for row in items) + "\n").encode()
        digest = hashlib.sha256(data).hexdigest()
        export = (self.data_root / relative_path).resolve()
        if not export.is_relative_to(self.data_root.resolve()):
            raise ValueError("Exportpad ligt buiten de datamap.")
        # Keep immutable, compressed snapshots. Rebuilding an export never requires rescraping.
        snapshot = self.root / "snapshots" / (digest + ".jsonl.gz")
        if not snapshot.exists():
            atomic_bytes(snapshot, gzip.compress(data, compresslevel=6, mtime=0))
        timestamp = now()
        checked_at = min((item.metadata["checked_at"] for item in resources), default=timestamp)
        previous_export = export.read_bytes() if export.exists() else None
        try:
            with self.db:
                self.db.execute("""INSERT INTO datasets(id,input_hash,content_hash,record_count,checked_at,succeeded_at,status,detail,coverage,export_path,last_attempt_at)
                    VALUES (?,?,?,?,? ,?,'ready','',?,?,?)
                    ON CONFLICT(id) DO UPDATE SET input_hash=excluded.input_hash,
                    content_hash=excluded.content_hash,record_count=excluded.record_count,
                    checked_at=excluded.checked_at,succeeded_at=excluded.succeeded_at,
                    status=excluded.status,detail='',coverage=excluded.coverage,export_path=excluded.export_path,last_attempt_at=excluded.last_attempt_at""",
                    (dataset,input_hash,digest,len(items),checked_at,timestamp,canonical(coverage),relative_path,timestamp))
                self.db.execute("DELETE FROM goal_search WHERE id IN (SELECT id FROM goals WHERE dataset=?)", (dataset,))
                self.db.execute("DELETE FROM goals WHERE dataset=?", (dataset,))
                self.db.executemany("INSERT INTO goals VALUES (?,?,?,?,?,?,?)", [
                    (row["corpus_id"],dataset,row["code"],row["titel"],row.get("netwerk", ""),
                     row.get("onderwijsniveau", ""),canonical(row)) for row in items])
                self.db.executemany("INSERT INTO goal_search VALUES (?,?,?)", [
                    (row["corpus_id"],row["code"],row["titel"]) for row in items])
                self._sources(dataset, resources)
                # Readers see either the old complete JSONL or the new complete one.
                atomic_bytes(export, data)
        except Exception:
            if previous_export is not None:
                atomic_bytes(export, previous_export)
            else:
                export.unlink(missing_ok=True)
            raise
        return {"dataset": dataset, "records": len(items), "sha256": digest,
                "bytes": len(data), "compressed_bytes": snapshot.stat().st_size,
                "status": "ready", "coverage": coverage}

    def verify(self, dataset: str) -> dict:
        state = self.state(dataset)
        if not state or not state["succeeded_at"]:
            return {"dataset": dataset, "valid": False, "reason": "Nog geen geldige bronversie"}
        export = self.data_root / state["export_path"]
        valid = export.is_file() and hashlib.sha256(export.read_bytes()).hexdigest() == state["content_hash"]
        count = self.db.execute("SELECT COUNT(*) FROM goals WHERE dataset=?", (dataset,)).fetchone()[0]
        digest = hashlib.sha256()
        for row in self.db.execute("SELECT payload FROM goals WHERE dataset=? ORDER BY id", (dataset,)):
            digest.update((row[0] + "\n").encode())
        return {"dataset": dataset, "valid": valid and count == state["record_count"] and digest.hexdigest() == state["content_hash"],
                "status": state["status"], "records": count, "checked_at": state["checked_at"],
                "succeeded_at": state["succeeded_at"]}

    def export(self, dataset: str):
        state = self.state(dataset)
        if not state or not state["succeeded_at"]:
            raise ValueError("Geen gevalideerde versie om te herstellen.")
        rows = self.db.execute("SELECT payload FROM goals WHERE dataset=? ORDER BY id", (dataset,))
        data = ("\n".join(row[0] for row in rows) + "\n").encode()
        if hashlib.sha256(data).hexdigest() != state["content_hash"]:
            raise ValueError("Catalogus wijkt af van de gevalideerde corpus-hash.")
        atomic_bytes(self.data_root / state["export_path"], data)
