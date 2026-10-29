"""Regression tests for execution/verify_triad_coverage.py deployed-site URL classification
(Codex findings on PR #154 and PR #160). Run: python3 -m unittest discover -s scripts/checks/regressions
The classifier decides by the parsed hostname, never by a pattern over the raw text.
TRIAD_CLASSIFIER_DIR overrides the directory the linter is imported from (used to show a pre-fix
copy fails)."""
import os
import subprocess
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, os.environ.get("TRIAD_CLASSIFIER_DIR", str(REPO / "execution")))

from verify_triad_coverage import is_deployed_site_url  # noqa: E402


class DeployedSiteUrl(unittest.TestCase):
    def test_userinfo_port_decoy_is_not_deployed(self):
        self.assertFalse(is_deployed_site_url("curl https://saoc.co.za:443@evil.com/x"))

    def test_userinfo_decoy_without_port_is_not_deployed(self):
        self.assertFalse(is_deployed_site_url("curl https://saoc.co.za@evil.com/"))

    def test_beta_userinfo_decoy_is_not_deployed(self):
        self.assertFalse(is_deployed_site_url("curl https://beta.saoc.co.za:443@evil.com/x"))

    def test_real_host_after_userinfo_is_deployed(self):
        # Golden userinfo.yaml / userinfo-decoy.yaml: the host after the last `@` is what counts.
        self.assertTrue(is_deployed_site_url("curl https://user@saoc.co.za/x"))
        self.assertTrue(is_deployed_site_url("curl https://evil.com@saoc.co.za/"))
        self.assertTrue(is_deployed_site_url("curl https://user@beta.saoc.co.za/"))

    def test_port_on_deployed_host_is_deployed(self):
        self.assertTrue(is_deployed_site_url("curl -sf https://beta.saoc.co.za:443/about"))

    def test_hostname_is_case_insensitive_and_rooted(self):
        self.assertTrue(is_deployed_site_url("curl HTTPS://Beta.SAOC.co.za./x"))

    def test_lookalikes_are_not_deployed(self):
        for url in (
            "https://saoc.co.za.evil.example/",
            "https://notsaoc.co.za/",
            "https://saoc.co.za-evil.com/",
            "https://evil.com/saoc.co.za",
        ):
            self.assertFalse(is_deployed_site_url(f"curl {url}"), url)

    def test_shell_terminators_end_the_host(self):
        for tail in (";", "|", "&&", "`", "]", ",", ">", "}", "'", '"', ")"):
            self.assertTrue(is_deployed_site_url(f"curl https://saoc.co.za{tail} x"), tail)

    # PR #160 re-review. A browser (WHATWG) treats `\` as `/` in an http(s) URL; curl does not.
    # Either may run an assertion's URL, so the deployed site is whichever host EITHER would reach.
    def test_backslash_before_userinfo_reaches_saoc_in_a_browser(self):
        # WHATWG host saoc.co.za (the `\` ends the authority); curl host evil.com.
        self.assertTrue(is_deployed_site_url("open https://saoc.co.za\\@evil.com/"))
        self.assertTrue(is_deployed_site_url("open https://beta.saoc.co.za\\x@evil.com/"))

    def test_backslash_userinfo_before_saoc_reaches_saoc_with_curl(self):
        # WHATWG host evil.com; curl sends it to saoc.co.za with userinfo `evil.com\`.
        self.assertTrue(is_deployed_site_url("curl https://evil.com\\@saoc.co.za/x"))

    def test_whatwg_only_authority_forms_are_deployed(self):
        for url in (
            "https:\\\\saoc.co.za/x",
            "HTTPS:/\\Beta.SAOC.co.za/x",
            "https:saoc.co.za/",
            "https:///saoc.co.za/",
            "https://saoc%2Eco.za/",
            "https://saoc。co.za/",
        ):
            self.assertTrue(is_deployed_site_url(f"open {url}"), url)

    def test_backslash_decoys_on_neither_reading_are_not_deployed(self):
        for url in (
            "https://evil.com\\saoc.co.za/",
            "https:\\\\evil.com\\@x/saoc.co.za",
            "https://saoc.co.za%2Eevil.com/",
        ):
            self.assertFalse(is_deployed_site_url(f"open {url}"), url)

    def test_missing_file_still_exits_two(self):
        result = subprocess.run(
            [sys.executable, str(REPO / "execution" / "verify_triad_coverage.py"), "no-such.yaml"],
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
