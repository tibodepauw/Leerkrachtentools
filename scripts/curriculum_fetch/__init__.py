"""Hulpmodules voor het ophalen van officiële leerplan- en minimumdoelenbronnen."""

from .config import DEFAULT_DATA_DIR, NETWORKS
from .downloader import CurriculumDownloader

__all__ = ["DEFAULT_DATA_DIR", "NETWORKS", "CurriculumDownloader"]
