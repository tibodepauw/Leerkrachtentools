"""Existing provider-specific parsers with complete inventories and bounded jobs."""
import logging
import re
from dataclasses import asdict
from urllib.parse import urljoin, urlsplit

from .adapters import Harvest, IncompleteSource
from .documents import parse_document
from .session import CachedSession


def document_role(source):
    # OVSG's separately offered general basisvorming document describes the
    # curriculum concept. The actual goal tables are in its SC-specific PDFs.
    title = " ".join(source.title.split()).casefold()
    if source.provider == "OVSG" and re.search(r"basisvorming\s+\d{2}/\d{2}/\d{4}$", title):
        return "context"
    return "goals"


def discover_kov(http, session):
    """Follow the actual subject-page links instead of constructing dead routes."""
    from bs4 import BeautifulSoup
    from scrape_secondary_curricula import KOV_INDEX, KOV_TABS, KOV_BASE, SourceDocument, infer_discipline, infer_stream
    subjects, found = {}, []
    for grade, tab in KOV_TABS:
        page = session.get(KOV_INDEX + "?tab=" + tab)
        soup = BeautifulSoup(page.content, "html.parser")
        count = 0
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            if re.match(r"^/(?:I|II|III|VII)(?:-|$)", href, re.I):
                title = anchor.get_text(" ", strip=True)
                subjects[(grade, urljoin(KOV_BASE, href))] = title
                count += 1
        if not count:
            raise IncompleteSource(f"KOV: geen vakkeninventaris voor {grade}.")
    for index, ((grade, url), title) in enumerate(subjects.items(), 1):
        logging.info("KOV vakpagina %s/%s", index, len(subjects))
        soup = BeautifulSoup(session.get(url).content, "html.parser")
        links = {urljoin(url, anchor["href"]) for anchor in soup.find_all("a", href=True)
                 if "leerplan" in anchor.get_text(" ", strip=True).casefold()
                 and (urlsplit(urljoin(url, anchor["href"])).path.rstrip("/").endswith(("/leerplan", "/leerplannen"))
                      or urlsplit(urljoin(url, anchor["href"])).path.startswith("/content/"))}
        if not links:
            raise IncompleteSource(f"KOV: geen officieel leerplanpad bij {title}.")
        for page_url in sorted(links):
            try:
                response = session.get(page_url)
            except RuntimeError as error:
                raise IncompleteSource(f"KOV: officiële bronlink bij {title} faalt: {page_url}. {error}") from None
            page = BeautifulSoup(response.content, "html.parser")
            documents = [(anchor.get_text(" ", strip=True), urljoin(page_url, anchor["href"]))
                         for anchor in page.find_all("a", href=True)
                         if "/download/content/" in anchor["href"] and urlsplit(anchor["href"]).path.lower().endswith((".docx", ".pdf"))]
            # Prefer the editable source when an identical edition is also offered
            # as PDF, but retain PDF-only subjects such as religion.
            word_documents = [item for item in documents if urlsplit(item[1]).path.lower().endswith(".docx")]
            if word_documents:
                documents = word_documents
            if not documents:
                raise IncompleteSource(f"KOV: geen doelendocument bij {title}.")
            # Keep every publicly offered edition. No assumption that link order establishes validity.
            for label, document_url in dict.fromkeys(documents):
                route = (title + " " + label).casefold()
                finality = next((value for token, value in (("d/a-finaliteit", "dubbele finaliteit"),
                    ("d-finaliteit", "doorstroomfinaliteit"), ("a-finaliteit", "arbeidsmarktfinaliteit")) if token in route), "")
                found.append(SourceDocument("KOV", title + " | " + label, document_url,
                    page_url, grade, finality, infer_stream(route), infer_discipline(title),
                    "docx" if urlsplit(document_url).path.lower().endswith(".docx") else "pdf"))
    return found


def secondary(dataset, http):
    from scrape_secondary_curricula import SecondaryCurriculumScraper
    session = CachedSession(http)
    scraper = SecondaryCurriculumScraper()
    scraper.session = session
    by_provider = {"GO": scraper.discover_go(), "KOV": discover_kov(http, session), "OVSG": scraper.discover_ovsg()}
    for name, rows in by_provider.items():
        if not rows:
            raise IncompleteSource(f"Secundair: geen volledige documentinventaris voor {name}.")
    documents = scraper._dedupe_documents([doc for rows in by_provider.values() for doc in rows])
    downloaded = {}
    for index, source in enumerate(documents, start=1):
        logging.info("Secundair bron %s/%s: %s", index, len(documents), source.provider)
        if source.url not in downloaded:
            if source.provider == "OVSG":
                http.fetch(source.page_url, force=True)
            resource = http.fetch(source.url, headers={"Referer": source.page_url})
            if not resource.content.startswith((b"%PDF", b"PK")):
                raise IncompleteSource("Secundair: bronbestand is geen PDF of Word-document.")
            downloaded[source.url] = resource
    resources = list(session.resources.values()) + list(downloaded.values())
    inventory = [{**asdict(source), "sha256": downloaded[source.url].sha256,
                  "role": document_role(source)} for source in documents]

    def parse():
        records = []
        for index, source in enumerate(documents, start=1):
            if document_role(source) == "context":
                continue
            logging.info("Secundair parser %s/%s: %s", index, len(documents), source.provider)
            resource = downloaded[source.url]
            kind = "secondary_docx" if resource.content.startswith(b"PK") else "secondary_pdf"
            rows = parse_document(kind, resource.path, asdict(source))
            if not rows:
                raise IncompleteSource(f"Secundair: geen doelen herkend in {source.title}.")
            for row in rows:
                row.update(bron_sha256=resource.sha256, bron_titel=source.title)
            records.extend(rows)
        return records
    return Harvest(resources, inventory, parse, {"complete": True,
                   "documents": len(documents), "provider_documents": {key: len(rows) for key, rows in by_provider.items()},
                   "scope": "Alle documenten uit de volledige publieke GO/KOV/OVSG-inventaris"})
