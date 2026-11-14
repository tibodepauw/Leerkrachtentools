"""Discover and retain the separately labelled older GO! basic curriculum."""
import logging
import re
from urllib.parse import urljoin

from .adapters import Harvest, IncompleteSource, clean
from .documents import parse_document


def go_old(dataset, http):
    from bs4 import BeautifulSoup
    page = http.fetch(dataset.source_url)
    soup = BeautifulSoup(page.content, "html.parser")
    subjects = {}
    for anchor in soup.find_all("a", href=True):
        url = urljoin(dataset.source_url, anchor["href"])
        relative = url.removeprefix(dataset.source_url)
        if url.startswith(dataset.source_url) and re.fullmatch(r"[a-z0-9-]+/?", relative):
            if "/download/" not in url and clean(anchor.get_text()):
                subjects[url] = clean(anchor.get_text(" ", strip=True))
    if len(subjects) < 8:
        raise IncompleteSource(f"Oud GO!: {len(subjects)} van minimaal acht vakpagina's gevonden.")
    resources, documents = [page], {}
    for url, label in subjects.items():
        resource = http.fetch(url)
        resources.append(resource)
        soup = BeautifulSoup(resource.content, "html.parser")
        found = 0
        for anchor in soup.find_all("a", href=True):
            title = clean(anchor.get_text(" ", strip=True))
            link = urljoin(url, anchor["href"])
            identifier = re.search(r"/download/(GOPRO-[^/]+)", link)
            if not identifier or "leerplan" not in title.casefold():
                continue
            documents.setdefault(identifier[1], {"url": link, "title": title,
                                "discipline": label, "page_url": url,
                                "role": "context" if url.rstrip("/").endswith("/algemeen") or
                                any(word in title.casefold() for word in ("bijlage", "digitaal cahier", "overzicht")) else "goals"})
            found += 1
        if not found:
            raise IncompleteSource(f"Oud GO!: vakpagina {label} heeft geen ontdekte leerplandocumenten.")
    downloaded = []
    for document in documents.values():
        resource = http.fetch(document["url"])
        if document["role"] == "context" and not resource.content.startswith((b"%PDF", b"PK", b"\xd0\xcf\x11\xe0")):
            raise IncompleteSource(f"Oud GO!: contextdownload {document['title']} is geen document.")
        if not resource.content.startswith(b"%PDF") and document["role"] != "context":
            raise IncompleteSource(f"Oud GO!: leerplandownload {document['title']} is geen PDF.")
        resources.append(resource)
        downloaded.append((document, resource))
    inventory = [{**document, "sha256": resource.sha256} for document, resource in downloaded]

    def parse():
        records = []
        for document, resource in downloaded:
            if document["role"] == "context":
                continue
            logging.info("Oud GO!: %s", document["title"])
            rows = parse_document("go_old", resource.path, document)
            if not rows:
                raise IncompleteSource(f"Oud GO!: geen doelrijen herkend in {document['title']}.")
            for row in rows:
                row["bron_sha256"] = resource.sha256
                row["bron_editie"] = "oud leerplan basisonderwijs, afzonderlijk bewaard"
            records.extend(rows)
        return records
    return Harvest(resources, inventory, parse, {"complete": True, "subjects": len(subjects),
                   "documents": len(downloaded), "edition": "oud leerplan basisonderwijs",
                   "scope": "Alle ontdekte hoofdleerplan-PDF's; visiedocumenten, overzichten, cahiers en bijlagen als ruwe context bewaard"})
