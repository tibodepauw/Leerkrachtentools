"""Inventory public curriculum hosts; optional bounded robots access probes.

No credentials, login, source downloads, proxy bypass or cloud configuration changes.
A successful robots probe proves neither source completeness nor reuse rights.
"""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LOGIN_HOSTS = {"leerlokaal.ovsg.be", "leerlokaalupdate.ovsg.be"}


def source_hosts(root: Path = ROOT) -> dict[str, list[str]]:
    sources: dict[str, set[str]] = {}
    files = list((root / "scripts").rglob("*.py")) + [root / "docs/curriculum-bronnen-urls.md"]
    for file in files:
        if "tests" in file.parts or file.name == Path(__file__).name:
            continue
        for host in re.findall(r"https?://([A-Za-z0-9.-]+)", file.read_text(encoding="utf-8")):
            if host == "github.com" or "." not in host:  # Attribution or a regex fragment, not a source.
                continue
            sources.setdefault(host.lower(), set()).add(str(file.relative_to(root)))
    return {host: sorted(files) for host, files in sorted(sources.items())}


def inventory(policy: dict, hosts: dict[str, list[str]]) -> list[dict]:
    http = policy.get("http_network_policy", {})
    allowed = {item["host"] for item in http.get("egress_rules", [])}
    return [
        {
            "host": host, "referencedBy": files,
            "allowlisted": http.get("type") == "unrestricted" or host in allowed,
            "accessScope": "login: not authorized" if host in LOGIN_HOSTS else "public probe only; API may require a key",
        }
        for host, files in hosts.items()
    ]


def probe(host: str, timeout: float) -> dict:
    url = "https://" + host + "/robots.txt"
    result = {"url": url, "checkedAt": datetime.now(timezone.utc).isoformat()}
    started = time.monotonic()
    try:
        request = Request(url, headers={"User-Agent": "Leerkrachtentools-public-corpus-validation/1.0"})
        with urlopen(request, timeout=timeout) as response:
            body = response.read(65_537)
            if len(body) > 65_536:
                raise ValueError("robots response exceeds 64 KiB")
            result.update(httpStatus=response.status, finalUrl=response.url, bytes=len(body))
            # No body, cookies, authorization headers or query tokens in reports.
            result["reachable"] = True
    except (URLError, ValueError, TimeoutError, OSError) as error:
        result.update(reachable=False, error=type(error).__name__ + ": " + str(error))
    result["seconds"] = round(time.monotonic() - started, 3)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--policy", type=Path, default=Path("/etc/codex/network-policy.json"))
    parser.add_argument("--probe", action="store_true", help="One robots request per public host; no retries.")
    args = parser.parse_args()
    items = inventory(json.loads(args.policy.read_text()), source_hosts())
    deadline = time.monotonic() + 60
    for item in items:
        if args.probe and item["host"] not in LOGIN_HOSTS:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                item["probe"] = {"reachable": False, "error": "global 60-second probe budget exhausted"}
            else:
                item["probe"] = probe(item["host"], min(5, remaining))
    report = {"checkedAt": datetime.now(timezone.utc).isoformat(), "hosts": items,
              "missingAllowlistHosts": [item["host"] for item in items if not item["allowlisted"]],
              "sourceFilesFetched": 0, "sourceRestrictionsAndReuseRights": "not established by a robots access probe"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 1 if any(not item["allowlisted"] or item.get("probe", {}).get("reachable") is False for item in items) else 0


if __name__ == "__main__":
    raise SystemExit(main())
