"""Every production dataset, including sources that need explicit access."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Dataset:
    id: str
    path: str
    adapter: str
    level: str
    network: str
    source_url: str


DATASETS = {
    item.id: item for item in [
        Dataset("OPSTAP", "opstap/opstap_volledig.jsonl", "opstap", "Basisonderwijs", "OPSTAP", "https://opstap.katholiekonderwijs.vlaanderen/"),
        Dataset("OVSG", "ovsg/ovsg_volledig.jsonl", "ovsg", "Basisonderwijs", "OVSG", "https://leerlokaal.ovsg.be/"),
        Dataset("OVSG_BAO_2027_2028", "ovsg/ovsg_2027_2028_volledig.jsonl", "ovsg_authenticated", "Basisonderwijs", "OVSG", "https://leerlokaal.ovsg.be/bao/leerplan"),
        Dataset("OVSG_SECUNDAIR_2025", "secundair/leerplannen_ovsg_2025.jsonl", "ovsg_authenticated", "Secundair", "OVSG", "https://leerlokaal.ovsg.be/so/leerplannen"),
        Dataset("GO_NIEUW", "go_nieuw/go_nieuw_volledig.jsonl", "go_new", "Basisonderwijs", "GO_NIEUW", "https://pro.g-o.be/themas/leerplannen/basisonderwijs/nieuw-leerplan-basisonderwijs/"),
        Dataset("GO_OUD", "go/go_volledig.jsonl", "go_old", "Basisonderwijs", "GO_OUD", "https://pro.g-o.be/themas/leerplannen/basisonderwijs/oud-leerplan-basisonderwijs/"),
        Dataset("ZILL", "zill/zill_volledig.jsonl", "zill", "Basisonderwijs", "ZILL", "https://zill.katholiekonderwijs.vlaanderen/"),
        Dataset("SECUNDAIR_LEERPLANNEN", "secundair/leerplannen_secundair.jsonl", "secondary", "Secundair", "ALL", "https://pro.g-o.be/themas/leerplannen/"),
        Dataset("SECUNDAIR_MINIMUMDOELEN", "secundair/minimumdoelen_secundair.jsonl", "education", "Secundair", "AHOVOKS", "https://www.onderwijsdoelen.be/"),
        Dataset("BASISONDERWIJS_MINIMUMDOELEN", "basisonderwijs/minimumdoelen_basisonderwijs.jsonl", "education", "Basisonderwijs", "AHOVOKS", "https://www.onderwijsdoelen.be/"),
        Dataset("POV", "secundair/leerplannen_pov_secundair.jsonl", "pov", "Secundair", "POV", "https://pov.classid.io/website/sapo-endpoints"),
        *[Dataset(id, f"{directory}/onderwijsdoelen_{directory}.jsonl", "education", level, "AHOVOKS", "https://www.onderwijsdoelen.be/")
          for id, directory, level in [("OKAN", "okan", "OKAN"), ("BUBAO", "bubao", "BuBaO"),
              ("BUSO", "buso", "BuSO"), ("DKO", "dko", "DKO"),
              ("VOLWASSENEN", "volwassenen", "Volwassenen"), ("HOGER", "hoger", "Hoger")]],
    ]
}

HOSTS = {
    "pro.g-o.be", "g-o.be", "www.g-o.be", "zill.katholiekonderwijs.vlaanderen",
    "zill-selector.katholiekonderwijs.vlaanderen", "opstap.katholiekonderwijs.vlaanderen",
    "pro.katholiekonderwijs.vlaanderen", "www.katholiekonderwijs.vlaanderen",
    "cached-api.katholiekonderwijs.vlaanderen", "api.katholiekonderwijs.vlaanderen",
    "www.ovsg.be", "ovsg.be", "leerlokaal.ovsg.be", "leerlokaalupdate.ovsg.be",
    "www.onderwijsdoelen.be", "onderwijsdoelen.be", "onderwijs.api.vlaanderen.be",
    "onderwijs-vlaanderen-portaalov.apigee.io", "assets.vlaanderen.be",
    "data-onderwijs.vlaanderen.be", "www.vlaanderen.be", "pov.classid.io", "classid.io",
}
