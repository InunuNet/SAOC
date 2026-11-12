"""compose() skips the '<Name>: ' prefix when the message already names the project."""
import importlib.util
import unittest
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "voice_say.py"
spec = importlib.util.spec_from_file_location("voice_say", SRC)
voice_say = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice_say)
compose = voice_say.compose


class ComposeTest(unittest.TestCase):
    def test_human_intro_no_prefix(self):
        msg = "Hey, Athanor just finished the Windows test"
        self.assertEqual(compose("Athanor", [], msg), msg)

    def test_possessive_no_prefix(self):
        msg = "Athanor's Windows test is green"
        self.assertEqual(compose("Athanor", [], msg), msg)

    def test_curly_possessive_no_prefix(self):
        msg = "Athanor’s Windows test is green"
        self.assertEqual(compose("Athanor", [], msg), msg)

    def test_formal_intro_stripped_and_reprefixed(self):
        self.assertEqual(compose("Athanor", [], "Athanor: done"), "Athanor: done")

    def test_plain_message_prefixed(self):
        self.assertEqual(compose("Athanor", [], "gate green"), "Athanor: gate green")

    def test_alias_no_prefix(self):
        msg = "Hey, gem is done"
        self.assertEqual(compose("Athanor", ["gem"], msg), msg)

    def test_name_late_in_message_no_prefix(self):
        msg = "Everything gated green on the Athanor project"
        self.assertEqual(compose("Athanor", [], msg), msg)

    def test_substring_not_matched(self):
        self.assertEqual(compose("Athanor", [], "Athanors done"), "Athanor: Athanors done")


if __name__ == "__main__":
    unittest.main()
