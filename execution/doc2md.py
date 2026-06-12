#!/usr/bin/env python3
"""Convert documents to clean Markdown for LLM context injection.

Uses Microsoft's markitdown library. Supports: PDF, DOCX, PPTX, XLSX, HTML, CSV, images.

Usage:
    python3 execution/doc2md.py input.pdf                  # prints to stdout
    python3 execution/doc2md.py input.docx output.md       # writes to file
    python3 execution/doc2md.py input.pdf --summarize 500  # truncate to ~500 words
"""

import sys
import argparse
import importlib.util

def check_dependency():
    if importlib.util.find_spec("markitdown") is None:
        print("❌ markitdown not installed. Run: pip install markitdown", file=sys.stderr)
        sys.exit(1)

def convert(input_path: str, max_words: int = 0) -> str:
    from markitdown import MarkItDown
    md = MarkItDown()
    result = md.convert(input_path)
    text = result.text_content.strip()
    
    if max_words > 0:
        words = text.split()
        if len(words) > max_words:
            text = " ".join(words[:max_words]) + f"\n\n[... truncated at {max_words} words, original: {len(words)} words]"
    
    return text

def main():
    parser = argparse.ArgumentParser(description="Convert documents to Markdown for LLM context.")
    parser.add_argument("input", help="Input file path (pdf, docx, pptx, xlsx, html, csv, etc.)")
    parser.add_argument("output", nargs="?", default=None, help="Output .md file (default: stdout)")
    parser.add_argument("--summarize", type=int, default=0, metavar="WORDS", help="Truncate output to N words")
    args = parser.parse_args()

    check_dependency()
    text = convert(args.input, args.summarize)

    if args.output:
        with open(args.output, "w") as f:
            f.write(text)
        print(f"✅ Converted → {args.output} ({len(text.split())} words)", file=sys.stderr)
    else:
        print(text)

if __name__ == "__main__":
    main()
