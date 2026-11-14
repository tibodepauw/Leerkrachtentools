"""Bounded public downloads with explicit hosts, robots and conditional caching."""
from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import requests

AGENT = "Leerkrachtentools-curriculum-updater/2.0"


class SourceBlocked(RuntimeError):
    pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f".{os.getpid()}.part")
    try:
        with os.fdopen(os.open(temporary, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


@dataclass(frozen=True)
class Resource:
    url: str
    path: Path
    metadata: dict

    @property
    def content(self) -> bytes:
        return self.path.read_bytes()

    @property
    def text(self) -> str:
        return self.content.decode("utf-8-sig")

    @property
    def sha256(self) -> str:
        return self.metadata["sha256"]


class HttpCache:
    def __init__(self, root: Path, hosts: set[str], *, session=None,
                 pause: float = 0.4, max_bytes: int = 32 * 1024 * 1024,
                 request_limit: int = 5000, offline: bool = False,
                 recent_seconds: int = 0,
                 snapshot_lookup=None,
                 run_bytes: int = 512 * 1024 * 1024, cache_bytes: int = 2 * 1024 * 1024 * 1024):
        self.root, self.hosts = root, hosts
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.session = session or requests.Session()
        self.pause, self.max_bytes = pause, max_bytes
        self.request_limit, self.offline = request_limit, offline
        self.recent_seconds = recent_seconds
        self.snapshot_lookup = snapshot_lookup
        self.run_bytes, self.cache_bytes = run_bytes, cache_bytes
        self.cached_bytes = sum(path.stat().st_size for path in (root / "objects").glob("*") if path.is_file())
        self.robots: dict[str, RobotFileParser] = {}
        self.last_request: dict[str, float] = {}
        self.used: dict[str, Resource] = {}
        self.metrics = {"requests": 0, "downloaded_bytes": 0, "not_modified": 0}

    def validate_url(self, url: str) -> str:
        parsed = urlsplit(url)
        if (parsed.scheme != "https" or parsed.hostname not in self.hosts
                or parsed.username or parsed.password or parsed.port not in (None, 443)):
            raise SourceBlocked("Bron-URL is geen toegestane publieke HTTPS-bron.")
        if any(key.casefold() in {"key", "api_key", "apikey", "token", "secret", "access_token"}
               for key, _ in parse_qsl(parsed.query)):
            raise SourceBlocked("Gebruik geen sleutel in een bron-URL; alleen veilige API-headers.")
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, ""))

    def _store_blob(self, digest: str, body: bytes) -> Path:
        blob = self.root / "objects" / digest
        existing_size = blob.stat().st_size if blob.exists() else 0
        if not blob.exists() or hashlib.sha256(blob.read_bytes()).hexdigest() != digest:
            if self.cached_bytes - existing_size + len(body) > self.cache_bytes:
                raise SourceBlocked("De eigen broncache heeft zijn schijfgrens bereikt; geen bron overschreven.")
            atomic_bytes(blob, body)
            self.cached_bytes += len(body) - existing_size
        return blob

    def _request(self, url: str, headers: dict, *, limit: int, check_robots: bool = True):
        for _ in range(5):
            url = self.validate_url(url)
            origin = urlunsplit((*urlsplit(url)[:2], "", "", ""))
            if check_robots:
                self._check_robots(origin, url)
            if self.metrics["requests"] >= self.request_limit:
                raise RuntimeError("De begrensde aanvraaglimiet voor deze run is bereikt.")
            wait = self.pause - (time.monotonic() - self.last_request.get(origin, 0))
            if wait > 0:
                time.sleep(wait)
            self.last_request[origin] = time.monotonic()
            self.metrics["requests"] += 1
            response = self.session.get(url, headers={**headers, "User-Agent": AGENT},
                                        timeout=(10, 45), allow_redirects=False, stream=True)
            if response.status_code in (301, 302, 303, 307, 308):
                destination = self.validate_url(urljoin(url, response.headers.get("Location", "")))
                response.close()
                if any(key.casefold() in {"authorization", "x-api-key", "api-key"} for key in headers):
                    raise SourceBlocked("Een API-antwoord probeert inlogheaders via een redirect door te sturen.")
                if urlsplit(destination).netloc != urlsplit(url).netloc:
                    headers = {k: v for k, v in headers.items()
                               if k.casefold() not in {"if-none-match", "if-modified-since"}}
                if destination == url:
                    raise SourceBlocked("Bron verwijst naar zichzelf.")
                url = destination
                continue
            body = bytearray()
            deadline = time.monotonic() + 90
            try:
                if response.status_code != 304:
                    for chunk in response.iter_content(64 * 1024):
                        if time.monotonic() > deadline:
                            raise RuntimeError("Bronbestand overschrijdt de totale downloadtijd.")
                        body.extend(chunk)
                        if len(body) > limit:
                            raise RuntimeError("Bronbestand overschrijdt de downloadgrens.")
                return response.status_code, dict(response.headers), bytes(body), url
            finally:
                response.close()
        raise SourceBlocked("Te veel redirects vanaf de bron.")

    def _check_robots(self, origin: str, url: str):
        if origin not in self.robots:
            status, _, body, _ = self._request(origin + "/robots.txt", {}, limit=65536, check_robots=False)
            parser = RobotFileParser()
            if status == 404:
                parser.parse(["User-agent: *", "Disallow:"])
            elif status in (401, 403):
                parser.parse(["User-agent: *", "Disallow: /"])
            elif status == 200:
                parser.parse(body.decode("utf-8-sig", "replace").splitlines())
            else:
                raise SourceBlocked(f"Robots-regels tijdelijk niet controleerbaar (HTTP {status}).")
            delay = parser.crawl_delay(AGENT) or 0
            if delay > 10:
                raise SourceBlocked("De bron vereist een langere wachttijd dan deze batch ondersteunt.")
            self.pause = max(self.pause, delay)
            self.robots[origin] = parser
        if not self.robots[origin].can_fetch(AGENT, url):
            raise SourceBlocked("De bron sluit dit pad uit voor geautomatiseerd ophalen.")

    def fetch(self, url: str, *, headers: dict | None = None, force: bool = False) -> Resource:
        url = self.validate_url(url)
        key = hashlib.sha256(url.encode()).hexdigest()
        meta_path = self.root / "urls" / (key + ".json")
        old = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        old_file = self.root / "objects" / old.get("sha256", "absent")
        if old and (not old_file.is_file() or hashlib.sha256(old_file.read_bytes()).hexdigest() != old["sha256"]):
            old = {}
        if not old and self.snapshot_lookup:
            snapshot = self.snapshot_lookup(url)
            if snapshot:
                body, metadata = snapshot
                digest = hashlib.sha256(body).hexdigest()
                if len(body) > self.max_bytes or digest != metadata.get("sha256"):
                    raise RuntimeError("Herstelde bronkopie overschrijdt haar grenzen of hash.")
                blob = self._store_blob(digest, body)
                atomic_bytes(meta_path, (json.dumps(metadata, ensure_ascii=False, sort_keys=True) + "\n").encode())
                old, old_file = metadata, blob
        if self.offline:
            if not old:
                raise SourceBlocked("Geen gecontroleerde bronkopie in de offlinecache.")
            result = Resource(url, old_file, old)
            self.used[url] = result
            return result
        if old and self.recent_seconds:
            try:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(old["checked_at"])).total_seconds()
            except (ValueError, KeyError, TypeError):
                age = -1
            if 0 <= age <= self.recent_seconds:
                result = Resource(url, old_file, old)
                self.used[url] = result
                return result
        request_headers = dict(headers or {})
        if old and not force:
            if old.get("etag"):
                request_headers["If-None-Match"] = old["etag"]
            if old.get("last_modified"):
                request_headers["If-Modified-Since"] = old["last_modified"]
        for attempt in range(3):
            try:
                status, response_headers, body, final_url = self._request(url, request_headers, limit=self.max_bytes)
            except requests.RequestException:
                if attempt == 2:
                    raise RuntimeError("Bronnetwerkfout na drie begrensde pogingen.") from None
                time.sleep(0.5 * (2 ** attempt))
                continue
            if status not in {429, 502, 503, 504} or attempt == 2:
                break
            retry = next((value for key, value in response_headers.items() if key.casefold() == "retry-after"), "")
            if retry:
                try:
                    delay = float(retry)
                except ValueError:
                    from email.utils import parsedate_to_datetime
                    try:
                        delay = (parsedate_to_datetime(retry) - datetime.now(timezone.utc)).total_seconds()
                    except (ValueError, TypeError):
                        delay = 0.5 * (2 ** attempt)
                if delay > 10:
                    raise SourceBlocked("Bron vraagt later opnieuw te proberen; laatste versie blijft behouden.")
            else:
                delay = 0.5 * (2 ** attempt)
            time.sleep(max(0, delay))
        folded = {k.casefold(): v for k, v in response_headers.items()}
        if status == 304:
            if not old:
                raise RuntimeError("Bron gaf 304 zonder bruikbare lokale kopie.")
            self.metrics["not_modified"] += 1
            metadata = {**old, "checked_at": now()}
        elif status == 200:
            if not body:
                raise RuntimeError("De bron gaf een leeg bestand.")
            if self.metrics["downloaded_bytes"] + len(body) > self.run_bytes:
                raise SourceBlocked("Het totale downloadbudget voor deze run is bereikt.")
            self.metrics["downloaded_bytes"] += len(body)
            digest = hashlib.sha256(body).hexdigest()
            self._store_blob(digest, body)
            metadata = {"url": url, "final_url": final_url, "sha256": digest,
                        "bytes": len(body), "content_type": folded.get("content-type", ""),
                        "etag": folded.get("etag", ""), "last_modified": folded.get("last-modified", ""),
                        "checked_at": now(), "fetched_at": now()}
        elif status in (401, 403):
            raise SourceBlocked(f"Bron vereist toegang of weigert deze aanvraag (HTTP {status}).")
        else:
            raise RuntimeError(f"Bronantwoord HTTP {status}; laatste geldige corpus blijft behouden.")
        atomic_bytes(meta_path, (json.dumps(metadata, ensure_ascii=False, sort_keys=True) + "\n").encode())
        result = Resource(url, self.root / "objects" / metadata["sha256"], metadata)
        self.used[url] = result
        return result
