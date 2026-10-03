from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from onderwijsdoelen_api_client import fetch_portal_dataset


class PortalCompletionTests(unittest.IsolatedAsyncioTestCase):
    async def fetch(self, payloads, navigation_error=None):
        page = Mock()
        page.wait_for_timeout = AsyncMock()
        browser = Mock()
        browser.new_page = AsyncMock(return_value=page)
        browser.close = AsyncMock()
        playwright = Mock()
        playwright.chromium.launch = AsyncMock(return_value=browser)
        context = Mock()
        context.__aenter__ = AsyncMock(return_value=playwright)
        context.__aexit__ = AsyncMock(return_value=False)

        async def visit(*args, **kwargs):
            if navigation_error:
                raise navigation_error
            callback = page.on.call_args.args[1]
            for payload in payloads:
                response = Mock(url="https://example.test/onderwijsdoel?paginanr=1", status=200)
                response.json = AsyncMock(return_value=payload)
                await callback(response)

        page.goto = AsyncMock(side_effect=visit)
        with patch("playwright.async_api.async_playwright", return_value=context):
            try:
                return await fetch_portal_dataset("SYNTHETIC")
            finally:
                browser.close.assert_awaited_once()

    async def test_complete_capture_preserves_dataset_and_records(self):
        records = await self.fetch([{"gegevens": {"member": [{"code": "1"}], "totalItems": 1}}])
        self.assertEqual(records, [{"code": "1", "_dataset": "SYNTHETIC"}])

    async def test_initial_page_is_not_a_complete_dataset(self):
        with self.assertRaisesRegex(RuntimeError, "onvolledig"):
            await self.fetch([{"gegevens": {"member": [{"code": "1"}], "totalItems": 2}}])

    async def test_missing_total_cannot_prove_capture_complete(self):
        with self.assertRaisesRegex(RuntimeError, "volledigheid"):
            await self.fetch([{"gegevens": {"member": [{"code": "1"}]}}])

    async def test_duplicate_capture_cannot_satisfy_total(self):
        with self.assertRaisesRegex(RuntimeError, "onvolledig"):
            await self.fetch([{"gegevens": {"member": [{"code": "1"}, {"code": "1"}], "totalItems": 2}}])

    async def test_complete_multiple_pages_and_retries_are_deduplicated(self):
        first = {"gegevens": {"member": [{"code": "1"}], "totalItems": 2}}
        second = {"gegevens": {"member": [{"code": "2"}], "totalItems": 2}}
        records = await self.fetch([first, first, second])
        self.assertEqual([record["code"] for record in records], ["1", "2"])

    async def test_navigation_error_closes_the_browser(self):
        with self.assertRaisesRegex(RuntimeError, "synthetic timeout"):
            await self.fetch([], navigation_error=RuntimeError("synthetic timeout"))
