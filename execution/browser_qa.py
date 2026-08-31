#!/usr/bin/env python3
"""browser_qa.py -- headless-browser evidence capture for QA of UI features.

Usage:
    python3 execution/browser_qa.py --url URL --screenshot PATH
        [--assert-text TEXT] [--assert-selector CSS] [--timeout-ms 15000]

Exit codes:
    0 -- PASS: page loaded, assertion (if given) satisfied, screenshot written.
    1 -- FAIL: page loaded but assertion was not satisfied, or page errored.
    2 -- ENV ERROR: playwright not installed / browsers not installed. Never
         treat this as a PASS -- surface it to the human, do not silently skip.

Never available: Write/Edit tool grants. This script is invoked over Bash,
which @qa already has -- no new tool access is required to use it.
"""
import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="URL to load (http(s):// or file://)")
    parser.add_argument("--screenshot", required=True, help="Path to write the PNG screenshot")
    parser.add_argument("--assert-text", default=None, help="Fail unless this text appears in the page")
    parser.add_argument("--assert-selector", default=None, help="Fail unless this CSS selector matches")
    parser.add_argument("--timeout-ms", type=int, default=15000, help="Navigation timeout in ms")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "ENV ERROR: playwright is not installed for this project.\n"
            "  Fix: pip install playwright && playwright install chromium\n"
            "This is not a QA failure -- it is a missing dependency. Do not "
            "report PASS or FAIL until the environment is fixed and this "
            "script runs cleanly.",
            file=sys.stderr,
        )
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

            page = browser.new_page()
            try:
                page.goto(args.url, timeout=args.timeout_ms)
            except Exception as exc:
                print(f"FAIL: could not load {args.url}: {exc}", file=sys.stderr)
                browser.close()
                return 1

            ok = True
            reasons = []

            if args.assert_text is not None:
                found = args.assert_text in page.content()
                if not found:
                    ok = False
                    reasons.append(f"text not found: {args.assert_text!r}")

            if args.assert_selector is not None:
                matched = page.query_selector(args.assert_selector) is not None
                if not matched:
                    ok = False
                    reasons.append(f"selector not found: {args.assert_selector!r}")

            page.screenshot(path=args.screenshot, full_page=True)
            browser.close()

            if ok:
                print(f"PASS: {args.url} -> {args.screenshot}")
                return 0

            print(f"FAIL: {args.url} -> {args.screenshot} ({'; '.join(reasons)})", file=sys.stderr)
            return 1
    except Exception as exc:
        print(f"ENV ERROR: unexpected browser_qa.py failure: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
