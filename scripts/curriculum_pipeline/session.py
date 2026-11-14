"""Requests-compatible public session for existing discovery code."""
from urllib.parse import urlencode

import requests


class CachedSession:
    def __init__(self, http):
        self.http = http
        self.headers = {}
        self.resources = {}

    def get(self, url, *, headers=None, params=None, **_options):
        if params:
            url += ("&" if "?" in url else "?") + urlencode(params, doseq=True)
        if url not in self.resources:
            self.resources[url] = self.http.fetch(url, headers={**self.headers, **(headers or {})})
        resource = self.resources[url]
        response = requests.Response()
        response.status_code = 200
        response._content = resource.content
        response._content_consumed = True
        response.url = resource.metadata.get("final_url", resource.url)
        response.headers["Content-Type"] = resource.metadata.get("content_type", "")
        response.encoding = "utf-8"
        return response
