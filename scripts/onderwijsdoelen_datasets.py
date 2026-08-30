"""Dataset- en domeinconfiguratie voor onderwijsdoelen.be."""

from __future__ import annotations

# Portal-routes (https://www.onderwijsdoelen.be/doelen/{id})
PORTAL_FILTER_ROUTES: dict[str, str] = {
    "OKAN": "OKAN",
    "BUBAO": "BUBAO",
    "BUSO_OV1": "BUSO_OV1",
    "BUSO_OV2": "BUSO_OV2",
    "BUSO_OV3": "BUSO_OV3",
    "DKO": "DKO",
    "VO": "VO",
    "HOGER": "HOGER",
}

# Concrete doelensets uit de Angular-portaalbundel (chunk-GWABYQ5Y.js)
PORTAL_DATASET_IDS: tuple[str, ...] = (
    "OKAN_V1_0",
    "BSO_OV1",
    "BSO_OV2",
    "BSO_OV3",
    "BSO_OV_1_3",
    "BSO_1STE_GRAAD_OV4_V2_1",
    "BSO_2DE_GRAAD_OV4_V2_1",
    "BSO_3DE_GRAAD_OV4_V2_1",
    "BSO_3DE_GRAAD_3DE_LEERJAAR_OV4_V2_1",
    "DKO_1STE_GRAAD",
    "DKO_1STE_GRAAD_V1_0",
    "DKO_2DE_GRAAD",
    "DKO_2DE_GRAAD_V1_0",
    "DKO_3DE_GRAAD",
    "DKO_3DE_GRAAD_V1_0",
    "DKO_4DE_GRAAD",
    "DKO_4DE_GRAAD_V2_0",
    "DKO_4DE_GRAAD_V2_1",
    "BASIS_EDU",
    "LERAREN_OPL",
    "SO_1STE_GRAAD_V2_1",
    "SO_2DE_GRAAD_V2_1",
    "SO_3DE_GRAAD_V2_1",
    "SO_3DE_GRAAD_3DE_LEERJAAR_V2_1",
    "SO_VWO",
)

DOMAIN_OUTPUT: dict[str, dict[str, str]] = {
    "OKAN": {
        "dir": "okan",
        "jsonl": "onderwijsdoelen_okan.jsonl",
        "gcs": "onderwijsdoelen_okan.txt",
    },
    "BUBAO": {
        "dir": "bubao",
        "jsonl": "onderwijsdoelen_bubao.jsonl",
        "gcs": "onderwijsdoelen_bubao.txt",
    },
    "BUSO": {
        "dir": "buso",
        "jsonl": "onderwijsdoelen_buso.jsonl",
        "gcs": "onderwijsdoelen_buso.txt",
    },
    "DKO": {
        "dir": "dko",
        "jsonl": "onderwijsdoelen_dko.jsonl",
        "gcs": "onderwijsdoelen_dko.txt",
    },
    "VOLWASSENEN": {
        "dir": "volwassenen",
        "jsonl": "onderwijsdoelen_volwassenen.jsonl",
        "gcs": "onderwijsdoelen_volwassenen.txt",
    },
    "HOGER": {
        "dir": "hoger",
        "jsonl": "onderwijsdoelen_hoger.jsonl",
        "gcs": "onderwijsdoelen_hoger.txt",
    },
}

DATASET_TO_DOMAIN: dict[str, str] = {
    "OKAN_V1_0": "OKAN",
    "BSO_OV1": "BUSO",
    "BSO_OV2": "BUSO",
    "BSO_OV3": "BUSO",
    "BSO_OV_1_3": "BUSO",
    "DKO_1STE_GRAAD": "DKO",
    "DKO_1STE_GRAAD_V1_0": "DKO",
    "DKO_2DE_GRAAD": "DKO",
    "DKO_2DE_GRAAD_V1_0": "DKO",
    "DKO_3DE_GRAAD": "DKO",
    "DKO_3DE_GRAAD_V1_0": "DKO",
    "DKO_4DE_GRAAD": "DKO",
    "DKO_4DE_GRAAD_V2_0": "DKO",
    "DKO_4DE_GRAAD_V2_1": "DKO",
    "BASIS_EDU": "VOLWASSENEN",
    "LERAREN_OPL": "HOGER",
}
