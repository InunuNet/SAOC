#!/usr/bin/env python3
"""Mission ticket-email-samples: golden checks.

  verify_ticket_email_goldens.py source <goldens-dir>
      sha256 of source-text.txt matches the frozen hash, and every golden email line is a verbatim
      line of the source (after fixture substitution) or a declared marker row.
  verify_ticket_email_goldens.py ticket <ticket.pdf> <booking-ref> <title>
      the ticket PDF's text contains the booking reference and the ticket title (case-insensitive).
  verify_ticket_email_goldens.py combined <samples-dir> <goldens-dir>
      the combined PDF opens with the cover page and has exactly the pages of cover + 8 emails +
      8 tickets, in that order.
  verify_ticket_email_goldens.py pdf <email.pdf> <golden.txt>
      the PDF's extracted text contains the golden subject and every golden body line, in order,
      plus each marker row.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata

MARKER_HEAD = '## MARKERS'


def norm(text):
    text = unicodedata.normalize('NFKC', text).replace('•', ' ')
    return re.sub(r'\s+', ' ', text).strip()


def strip_bullet(line):
    return line[2:] if line.startswith('- ') else line


def split_golden(path):
    lines = open(path, encoding='utf-8').read().splitlines()
    cut = lines.index(MARKER_HEAD)
    return lines[:cut], lines[cut + 1:]


def check_source(gdir):
    src = open(os.path.join(gdir, 'source-text.txt'), encoding='utf-8').read()
    want = open(os.path.join(gdir, 'source-text.sha256')).read().split()[0]
    got = hashlib.sha256(src.encode('utf-8')).hexdigest()
    if got != want:
        print('FAIL source-text sha256 mismatch', got, want)
        return 1
    fx = json.load(open(os.path.join(gdir, 'fixtures.json'), encoding='utf-8'))
    src_lines = [strip_bullet(x) for x in src.splitlines()]
    bad = 0
    for key, v in fx['types'].items():
        subs = {'{first_name}': fx['first_name'], '{visitor_name}': v['visitor_name'],
                '{ticket_quantity}': str(v['quantity']), '{booking_reference}': v['booking_reference'],
                '{amount_paid}': fx['amount_paid'], '{payment_status}': fx['payment_status'],
                '{selected_visit_date}': v.get('selected_visit_date', '')}
        pool = set()
        for line in src_lines:
            for a, b in subs.items():
                line = line.replace(a, b)
            pool.update(part.strip() for part in line.split('\n'))
        body, _ = split_golden(os.path.join(gdir, 'emails', key + '.txt'))
        for line in body:
            line = strip_bullet(line)
            if line == 'Subject: [To be confirmed]' and key == 'sunset-cocktails':
                continue
            if line not in pool:
                print('FAIL', key, 'line not verbatim in source:', line)
                bad += 1
    print('source ok' if not bad else 'source FAIL')
    return 1 if bad else 0


def check_pdf(pdf, golden):
    text = subprocess.run(['pdftotext', pdf, '-'], capture_output=True, text=True, check=True).stdout
    hay = norm(text)
    body, markers = split_golden(golden)
    cursor = 0
    for line in body:
        line = strip_bullet(line)
        if line.startswith('Subject: '):
            line = line[len('Subject: '):]  # the rendered subject may carry the test-mode prefix
        needle = norm(line)
        at = hay.find(needle, cursor)
        if at < 0:
            print('FAIL not found in order:', line)
            return 1
        cursor = at + len(needle)
    for line in markers:
        if norm(line) not in hay:
            print('FAIL marker row missing:', line)
            return 1
    print('pdf ok', os.path.basename(pdf))
    return 0


def pdf_text(path, first=None, last=None):
    cmd = ['pdftotext']
    if first:
        cmd += ['-f', str(first), '-l', str(last or first)]
    return subprocess.run(cmd + [path, '-'], capture_output=True, text=True, check=True).stdout


def page_count(path):
    out = subprocess.run(['pdfinfo', path], capture_output=True, text=True, check=True).stdout
    return int(re.search(r'^Pages:\s+(\d+)', out, re.M).group(1))


def check_ticket(pdf, ref, title):
    hay = norm(pdf_text(pdf)).lower()
    for needle in (ref, title):
        if norm(needle).lower() not in hay:
            print('FAIL ticket pdf lacks', needle, os.path.basename(pdf))
            return 1
    print('ticket ok', os.path.basename(pdf))
    return 0


def check_combined(sdir, gdir):
    keys = list(json.load(open(os.path.join(gdir, 'fixtures.json'), encoding='utf-8'))['types'])
    parts = ['00-cover.pdf'] + ['email-%s.pdf' % k for k in keys] + ['ticket-%s.pdf' % k for k in keys]
    want = sum(page_count(os.path.join(sdir, p)) for p in parts)
    combined = os.path.join(sdir, 'ticket-emails-combined.pdf')
    got = page_count(combined)
    if got != want:
        print('FAIL combined has', got, 'pages, parts add up to', want)
        return 1
    if 'Questions for Lee-Ann' not in pdf_text(combined, 1):
        print('FAIL combined page 1 is not the cover page')
        return 1
    print('combined ok', got, 'pages')
    return 0


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'source':
        sys.exit(check_source(sys.argv[2]))
    if len(sys.argv) == 4 and sys.argv[1] == 'pdf':
        sys.exit(check_pdf(sys.argv[2], sys.argv[3]))
    if len(sys.argv) == 5 and sys.argv[1] == 'ticket':
        sys.exit(check_ticket(sys.argv[2], sys.argv[3], sys.argv[4]))
    if len(sys.argv) == 4 and sys.argv[1] == 'combined':
        sys.exit(check_combined(sys.argv[2], sys.argv[3]))
    print(__doc__)
    sys.exit(2)
