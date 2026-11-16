#!/usr/bin/env python3
"""browser_qa.py -- headless-browser evidence capture for QA of UI features.

Usage:
    python3 execution/browser_qa.py --url URL --screenshot PATH
        [--width 1440] [--assert-text TEXT] [--assert-selector CSS] [--timeout-ms 15000]

Engines (env BROWSER_QA_ENGINE=auto|playwright|chrome, default auto):
    playwright -- full feature set: screenshots plus --assert-text / --assert-selector.
    chrome     -- plain screenshots via a headless Chromium-family browser (Chrome, Chromium,
                  Edge, Brave). Env BROWSER_QA_CHROME names the executable; a path that does
                  not exist counts as no browser. Assertions are not available here.
    auto       -- playwright when importable with its browser installed, else chrome.

Exit codes:
    0 -- PASS: page loaded, assertion (if given) satisfied, screenshot written.
    1 -- FAIL: page loaded but assertion was not satisfied, or page errored.
    2 -- ENV ERROR: no usable engine (no playwright and no Chromium-family browser), or an
         assertion was requested without playwright. No screenshot file is written. Never
         treat this as a PASS -- surface it to the human, do not silently skip.

Never available: Write/Edit tool grants. This script is invoked over Bash,
which @qa already has -- no new tool access is required to use it.
"""
import argparse
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

DEFAULT_WIDTH = 1440
CHROME_HEIGHT = 900
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
REACH_TIMEOUT_S = 5
PROFILE_RETRY_S = 0.5
ENGINES = ("auto", "playwright", "chrome")
MAC_APPS = (
    ("Google Chrome.app", "Google Chrome"),
    ("Chromium.app", "Chromium"),
    ("Microsoft Edge.app", "Microsoft Edge"),
    ("Brave Browser.app", "Brave Browser"),
)
WINDOWS_APPS = (
    ("Google", "Chrome", "chrome.exe"),
    ("Microsoft", "Edge", "msedge.exe"),
)
WINDOWS_ROOTS = ("ProgramFiles", "ProgramFiles(x86)", "LocalAppData")
LINUX_NAMES = (
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
    "microsoft-edge", "brave-browser",
)
PLAYWRIGHT_HINT = "pip install playwright && playwright install chromium"


def find_chrome() -> "str | None":
    """Return a Chromium-family executable path, or None."""
    override = os.environ.get("BROWSER_QA_CHROME")
    if override:
        return override if Path(override).is_file() else None
    candidates = []
    if sys.platform == "darwin":
        for base in (Path("/Applications"), Path.home() / "Applications"):
            for app, exe in MAC_APPS:
                candidates.append(base / app / "Contents" / "MacOS" / exe)
    elif sys.platform.startswith("win"):
        for var in WINDOWS_ROOTS:
            root = os.environ.get(var)
            if root:
                for vendor, product, exe in WINDOWS_APPS:
                    candidates.append(Path(root) / vendor / product / "Application" / exe)
    else:
        for name in LINUX_NAMES:
            found = shutil.which(name)
            if found:
                candidates.append(Path(found))
    for cand in candidates:
        if cand.is_file():
            return str(cand)
    return None


def playwright_ready() -> bool:
    """True when playwright imports and its chromium build is installed."""
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            return Path(p.chromium.executable_path).exists()
    except Exception:
        return False


def remove_profile(profile: str) -> None:
    """Remove the throwaway Chrome profile; retry once, then say what was left behind."""
    for _attempt in range(2):
        shutil.rmtree(profile, ignore_errors=True)
        if not Path(profile).exists():
            return
        time.sleep(PROFILE_RETRY_S)
    print(f"WARN: could not remove temporary Chrome profile {profile}", file=sys.stderr)


def url_reachable(url: str, timeout_s: float) -> "str | None":
    """None when an http(s) URL answers (any status); else a reason. Other schemes pass."""
    if urlparse(url).scheme not in ("http", "https"):
        return None
    try:
        urllib.request.urlopen(url, timeout=timeout_s).close()
    except urllib.error.HTTPError:
        return None
    except (urllib.error.URLError, OSError) as exc:
        return str(getattr(exc, "reason", exc))
    return None


def is_png(path: Path, width: int) -> bool:
    try:
        with open(path, "rb") as handle:
            data = handle.read()
        if not data.startswith(PNG_MAGIC):
            return False
        pos = len(PNG_MAGIC)
        saw_ihdr = False
        while pos + 12 <= len(data):
            length = struct.unpack_from(">I", data, pos)[0]
            end = pos + 12 + length
            if end > len(data):
                return False
            kind = data[pos + 4:pos + 8]
            payload = data[pos + 8:pos + 8 + length]
            if kind == b"IHDR":
                if saw_ihdr or length != 13:
                    return False
                image_width, image_height = struct.unpack_from(">II", payload)
                if image_width != width or image_height == 0:
                    return False
                saw_ihdr = True
            elif kind == b"IEND":
                return saw_ihdr and length == 0 and end == len(data)
            pos = end
        return False
    except (OSError, struct.error):
        return False


def run_chrome(args, chrome: str) -> int:
    shot = Path(args.screenshot).resolve()
    if shot.suffix.lower() != ".png":
        print(f"ENV ERROR: the chrome engine writes PNG only; --screenshot must end in .png "
              f"(got {args.screenshot})", file=sys.stderr)
        return 2
    reason = url_reachable(args.url, REACH_TIMEOUT_S)
    if reason is not None:
        print(f"FAIL: could not reach {args.url}: {reason}", file=sys.stderr)
        return 1
    shot.parent.mkdir(parents=True, exist_ok=True)
    shot.unlink(missing_ok=True)
    profile = tempfile.mkdtemp(prefix=".bqa-", dir=str(shot.parent))
    cmd = [
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
        "--no-default-browser-check", f"--window-size={args.width},{CHROME_HEIGHT}",
        f"--user-data-dir={profile}", f"--screenshot={shot}", args.url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True,
                              timeout=max(args.timeout_ms // 1000, 1) + 30)
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"FAIL: chrome could not capture {args.url}: {exc}", file=sys.stderr)
        return 1
    finally:
        remove_profile(profile)
    if proc.returncode != 0 or not is_png(shot, args.width):
        shot.unlink(missing_ok=True)
        print(f"FAIL: chrome exited {proc.returncode} without a valid PNG for {args.url}",
              file=sys.stderr)
        return 1
    print(f"PASS: {args.url} -> {args.screenshot} (engine=chrome, width={args.width})")
    return 0


def run_playwright(args) -> int:
    from playwright.sync_api import sync_playwright

    shot = Path(args.screenshot)
    if shot.suffix.lower() != ".png":
        print(f"ENV ERROR: the playwright engine writes PNG only; --screenshot must end in .png "
              f"(got {args.screenshot})", file=sys.stderr)
        return 2

    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
            except Exception as exc:
                print(
                    f"ENV ERROR: chromium failed to launch ({exc}).\n"
                    "  Fix: playwright install chromium",
                    file=sys.stderr,
                )
                return 2

            page = browser.new_page(viewport={"width": args.width, "height": CHROME_HEIGHT})
            try:
                page.goto(args.url, timeout=args.timeout_ms)
            except Exception as exc:
                print(f"FAIL: could not load {args.url}: {exc}", file=sys.stderr)
                browser.close()
                return 1

            reasons = []
            if args.assert_text is not None and args.assert_text not in page.content():
                reasons.append(f"text not found: {args.assert_text!r}")
            if args.assert_selector is not None:
                if page.query_selector(args.assert_selector) is None:
                    reasons.append(f"selector not found: {args.assert_selector!r}")

            shot.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=args.screenshot, full_page=True)
            browser.close()

            if not is_png(shot, args.width):
                shot.unlink(missing_ok=True)
                print(f"FAIL: invalid PNG for {args.url}", file=sys.stderr)
                return 1

            if not reasons:
                print(f"PASS: {args.url} -> {args.screenshot}")
                return 0
            print(f"FAIL: {args.url} -> {args.screenshot} ({'; '.join(reasons)})", file=sys.stderr)
            return 1
    except Exception as exc:
        print(f"ENV ERROR: unexpected browser_qa.py failure: {exc}", file=sys.stderr)
        return 2


def no_playwright(reason: str) -> int:
    print(
        f"ENV ERROR: {reason}\n"
        f"  Fix: {PLAYWRIGHT_HINT}\n"
        "This is not a QA failure -- it is a missing dependency. Do not "
        "report PASS or FAIL until the environment is fixed and this "
        "script runs cleanly.",
        file=sys.stderr,
    )
    return 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="URL to load (http(s):// or file://)")
    parser.add_argument("--screenshot", required=True, help="Path to write the PNG screenshot")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help="Viewport width in px")
    parser.add_argument("--assert-text", default=None, help="Fail unless this text appears in the page")
    parser.add_argument("--assert-selector", default=None, help="Fail unless this CSS selector matches")
    parser.add_argument("--timeout-ms", type=int, default=15000, help="Navigation timeout in ms")
    args = parser.parse_args()

    engine = os.environ.get("BROWSER_QA_ENGINE", "auto").strip().lower() or "auto"
    if engine not in ENGINES:
        print(f"ENV ERROR: BROWSER_QA_ENGINE must be one of {ENGINES}, got {engine!r}",
              file=sys.stderr)
        return 2
    needs_playwright = args.assert_text is not None or args.assert_selector is not None

    if engine == "auto":
        engine = "playwright" if needs_playwright or playwright_ready() else "chrome"
    if engine == "playwright":
        try:
            import playwright.sync_api  # noqa: F401
        except ImportError:
            return no_playwright("playwright is not installed for this project.")
        return run_playwright(args)

    if needs_playwright:
        return no_playwright("--assert-text/--assert-selector need playwright; "
                             "the chrome engine only takes screenshots.")
    chrome = find_chrome()
    if chrome is None:
        print(
            "ENV ERROR: no Chromium-family browser found (Chrome, Chromium, Edge, Brave) and "
            f"playwright is unavailable.\n  Fix: install one, set BROWSER_QA_CHROME, or {PLAYWRIGHT_HINT}",
            file=sys.stderr,
        )
        return 2
    return run_chrome(args, chrome)


if __name__ == "__main__":
    sys.exit(main())
