from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audit_curriculum_sources import inventory, source_hosts


class CurriculumSourceInventoryTests(unittest.TestCase):
    def test_exact_host_membership_does_not_imply_subdomain_access(self):
        policy = {"http_network_policy": {"type": "restricted", "egress_rules": [{"host": "vlaanderen.be"}]}}
        result = inventory(policy, {"assets.vlaanderen.be": ["source.py"]})
        self.assertFalse(result[0]["allowlisted"])

    def test_lists_download_cdn_and_auth_hosts_without_attempting_login(self):
        hosts = source_hosts()
        for host in ["assets.vlaanderen.be", "pro.g-o.be", "www.onderwijsdoelen.be", "cached-api.katholiekonderwijs.vlaanderen", "leerlokaal.ovsg.be"]:
            self.assertIn(host, hosts)
        result = inventory({}, {"leerlokaal.ovsg.be": ["source.py"]})
        self.assertEqual(result[0]["accessScope"], "login: not authorized")

    def test_attribution_host_is_not_a_curriculum_source(self):
        self.assertNotIn("github.com", source_hosts())

    def test_escaped_regex_fragment_is_not_a_hostname(self):
        self.assertNotIn("www", source_hosts())
