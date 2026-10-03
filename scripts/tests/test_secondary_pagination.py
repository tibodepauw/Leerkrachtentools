from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_secondary_minimum_goals import SecondaryMinimumGoalsFetcher


class SecondaryPaginationTests(unittest.TestCase):
    def run_fetch(self, next_links, max_pages=3):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "corpus.jsonl"
            fetcher = SecondaryMinimumGoalsFetcher(
                api_key="synthetic-test-key", api_url="https://example.test/goals",
                filters={}, output=output, max_pages=max_pages,
            )
            responses = []
            for index, link in enumerate(next_links):
                response = Mock(status_code=200, url="https://example.test/goals" if index == 0 else "https://example.test/page2")
                response.json.return_value = {"next": link} if link else {}
                responses.append(response)
            with patch.object(fetcher.session, "get", side_effect=responses), patch(
                "fetch_secondary_minimum_goals.extract_api_goals", return_value=[{"code": "SYNTHETIC"}]
            ), patch.object(fetcher, "_write") as write:
                try:
                    result = fetcher.run()
                except RuntimeError:
                    write.assert_not_called()
                    self.assertFalse(output.exists())
                    raise
            write.assert_called_once()
            return result

    def test_explicit_terminal_page_can_publish(self):
        self.assertEqual(self.run_fetch(["/page2", None]), [{"code": "SYNTHETIC"}])

    def test_page_limit_does_not_publish_a_partial_corpus(self):
        with self.assertRaisesRegex(RuntimeError, "onvolledig"):
            self.run_fetch(["/page2"], max_pages=1)

    def test_pagination_cycle_does_not_publish_a_partial_corpus(self):
        with self.assertRaisesRegex(RuntimeError, "onvolledig"):
            self.run_fetch(["/page2", "/goals"])

    def test_next_page_cannot_forward_api_key_to_another_host(self):
        with self.assertRaisesRegex(RuntimeError, "andere origin"):
            self.run_fetch(["https://other.test/page2", None])

    def test_http_redirect_cannot_forward_api_key(self):
        fetcher = SecondaryMinimumGoalsFetcher(api_key="synthetic-test-key", api_url="https://example.test/goals", filters={})
        response = Mock(status_code=302)
        with patch.object(fetcher.session, "get", return_value=response) as request, patch.object(fetcher, "_write") as write:
            with self.assertRaisesRegex(RuntimeError, "redirect"):
                fetcher.run()
        self.assertFalse(request.call_args.kwargs["allow_redirects"])
        write.assert_not_called()
