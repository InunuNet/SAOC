#!/usr/bin/env python3
"""Herald — Structured Log Formatter.

Reads log lines from stdin, parses them by --format, emits JSONL.
"""
import sys
import re
import json
import argparse
from datetime import datetime, timezone, timedelta


# ---------------------------------------------------------------------------
# Level mappings
# ---------------------------------------------------------------------------

SYSLOG_SEVERITY_MAP = {
    0: "error",   # emerg
    1: "error",   # alert
    2: "error",   # crit
    3: "error",   # error
    4: "warn",    # warn
    5: "info",    # notice
    6: "info",    # info
    7: "debug",   # debug
}

JSON_LEVEL_MAP = {
    "warning": "warn",
    "warn": "warn",
    "error": "error",
    "err": "error",
    "info": "info",
    "information": "info",
    "debug": "debug",
    "dbg": "debug",
    "notice": "info",
    "critical": "error",
    "crit": "error",
    "emerg": "error",
    "emergency": "error",
    "alert": "error",
}

# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------

_SYSLOG_MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

# RFC 5424 full timestamp pattern: 2003-10-11T22:14:15.003Z or with offset
_RFC5424_TS_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))"
)

# BSD syslog timestamp: Oct 11 22:14:15 (no year, no tz — assume local/UTC)
_BSD_TS_RE = re.compile(
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})"
)


def _parse_syslog_timestamp(ts_str: str) -> str | None:
    """Parse a syslog timestamp to ISO8601 UTC string."""
    # Try RFC 5424 full format first
    m = _RFC5424_TS_RE.match(ts_str)
    if m:
        raw = m.group(1)
        try:
            if raw.endswith("Z"):
                dt = datetime.fromisoformat(raw[:-1]).replace(tzinfo=timezone.utc)
            else:
                dt = datetime.fromisoformat(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                else:
                    dt = dt.astimezone(timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass

    # Try BSD syslog format: Mon DD HH:MM:SS
    m = _BSD_TS_RE.match(ts_str)
    if m:
        month_name, day, hour, minute, second = m.groups()
        month = _SYSLOG_MONTHS.get(month_name)
        if month:
            year = datetime.now(timezone.utc).year
            try:
                dt = datetime(year, month, int(day), int(hour), int(minute), int(second),
                              tzinfo=timezone.utc)
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                pass
    return None


_NGINX_TS_RE = re.compile(
    r"(\d{2})/(\w{3})/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-])(\d{2})(\d{2})"
)

_NGINX_MONTHS = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}


def _parse_nginx_timestamp(ts_str: str) -> str | None:
    """Parse nginx combined log timestamp to ISO8601 UTC string.

    Format: 10/Oct/2000:13:55:36 -0700
    """
    m = _NGINX_TS_RE.match(ts_str)
    if not m:
        return None
    day, mon_name, year, hour, minute, second, sign, tz_h, tz_m = m.groups()
    month = _NGINX_MONTHS.get(mon_name)
    if not month:
        return None
    try:
        offset_minutes = int(tz_h) * 60 + int(tz_m)
        if sign == "-":
            offset_minutes = -offset_minutes
        tz = timezone(timedelta(minutes=offset_minutes))
        dt = datetime(int(year), month, int(day), int(hour), int(minute), int(second), tzinfo=tz)
        dt_utc = dt.astimezone(timezone.utc)
        return dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def _parse_generic_timestamp(ts_str: str) -> str | None:
    """Try to parse a generic ISO8601 or similar timestamp to UTC string."""
    if not ts_str:
        return None
    ts_str = ts_str.strip()
    # Handle Z suffix
    if ts_str.endswith("Z"):
        try:
            dt = datetime.fromisoformat(ts_str[:-1]).replace(tzinfo=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    # Try fromisoformat (handles offsets in Python 3.7+)
    try:
        dt = datetime.fromisoformat(ts_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        pass
    return None


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

# Syslog: <PRI>TIMESTAMP HOSTNAME APPNAME[PID]: MSG
# We handle both RFC 5424 and BSD syslog
_SYSLOG_RE = re.compile(
    r"^<(\d+)>"                              # <PRI>
    r"(.+?)\s+"                              # TIMESTAMP (greedy-stop at first space after ts)
    r"(\S+)\s+"                              # HOSTNAME
    r"(\S+?)(?:\[(\d+)\])?:\s*"             # APPNAME[PID]:
    r"(.*)"                                  # MSG
)

# Simpler BSD syslog pattern: <PRI>Mon DD HH:MM:SS HOST APP[PID]: MSG
# BSD timestamp is 3+1+2 or 3+2+2 tokens
_SYSLOG_BSD_RE = re.compile(
    r"^<(\d+)>"
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})"
    r"\s+(\S+)"                              # HOSTNAME
    r"\s+(\S+?)(?:\[(\d+)\])?"              # APP[PID]
    r":\s*(.*)"                              # MSG
)


def parse_syslog(line: str) -> dict:
    """Parse a syslog line. Returns canonical dict."""
    raw = line

    # Try BSD format first (most common)
    m = _SYSLOG_BSD_RE.match(line)
    if m:
        pri_str, ts_str, host, app, pid, msg = m.groups()
        pri = int(pri_str)
        severity = pri % 8
        level = SYSLOG_SEVERITY_MAP.get(severity, "unknown")
        timestamp = _parse_syslog_timestamp(ts_str)
        return {
            "timestamp": timestamp,
            "level": level,
            "host": host,
            "app": app,
            "message": msg.strip() if msg else "",
            "raw": raw,
            "parse_error": None,
        }

    # Try generic pattern (RFC 5424 style)
    m = _SYSLOG_RE.match(line)
    if m:
        pri_str, ts_str, host, app, pid, msg = m.groups()
        pri = int(pri_str)
        severity = pri % 8
        level = SYSLOG_SEVERITY_MAP.get(severity, "unknown")
        timestamp = _parse_syslog_timestamp(ts_str.strip())
        return {
            "timestamp": timestamp,
            "level": level,
            "host": host,
            "app": app,
            "message": msg.strip() if msg else "",
            "raw": raw,
            "parse_error": None,
        }

    return {
        "timestamp": None,
        "level": None,
        "host": None,
        "app": None,
        "message": None,
        "raw": raw,
        "parse_error": "syslog parse failed: no matching pattern",
    }


# Nginx combined log format
# IP - USER [TIMESTAMP] "METHOD PATH PROTO" STATUS BYTES "REFERER" "UA"
_NGINX_RE = re.compile(
    r'^(\S+)'           # IP
    r'\s+-\s+'          # -
    r'(\S+)'            # USER
    r'\s+\[([^\]]+)\]'  # [TIMESTAMP]
    r'\s+"([^"]*)"'     # "REQUEST"
    r'\s+(\d+)'         # STATUS
    r'\s+(\S+)'         # BYTES
    r'\s+"([^"]*)"'     # "REFERER"
    r'\s+"([^"]*)"'     # "UA"
)


def _nginx_status_to_level(status: int) -> str:
    if status >= 500:
        return "error"
    if status >= 400:
        return "warn"
    if status >= 300:
        return "info"
    if status >= 200:
        return "info"
    return "debug"  # 1xx


def parse_nginx(line: str) -> dict:
    """Parse an nginx combined log line."""
    raw = line
    m = _NGINX_RE.match(line)
    if not m:
        return {
            "timestamp": None,
            "level": None,
            "host": None,
            "app": None,
            "message": None,
            "raw": raw,
            "parse_error": "nginx parse failed: line does not match combined log format",
        }

    ip, user, ts_str, request, status_str, bytes_str, referer, ua = m.groups()
    try:
        status = int(status_str)
    except ValueError:
        return {
            "timestamp": None,
            "level": None,
            "host": None,
            "app": None,
            "message": None,
            "raw": raw,
            "parse_error": f"nginx parse failed: invalid status code '{status_str}'",
        }

    timestamp = _parse_nginx_timestamp(ts_str)
    level = _nginx_status_to_level(status)

    # Build a useful message
    message = f'{request} {status_str} {bytes_str}'

    return {
        "timestamp": timestamp,
        "level": level,
        "host": ip,
        "app": "nginx",
        "message": message,
        "raw": raw,
        "parse_error": None,
    }


def parse_json_line(line: str) -> dict:
    """Parse a JSON log line and normalize fields."""
    raw = line
    try:
        obj = json.loads(line)
    except json.JSONDecodeError as e:
        return {
            "timestamp": None,
            "level": None,
            "host": None,
            "app": None,
            "message": None,
            "raw": raw,
            "parse_error": f"json parse failed: {e}",
        }

    if not isinstance(obj, dict):
        return {
            "timestamp": None,
            "level": None,
            "host": None,
            "app": None,
            "message": None,
            "raw": raw,
            "parse_error": "json parse failed: top-level value is not an object",
        }

    # Normalize timestamp
    ts_raw = obj.get("timestamp") or obj.get("time") or obj.get("ts") or obj.get("@timestamp")
    timestamp = None
    if ts_raw:
        if isinstance(ts_raw, (int, float)):
            # Unix epoch
            try:
                dt = datetime.fromtimestamp(ts_raw, tz=timezone.utc)
                timestamp = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            except (OSError, OverflowError, ValueError):
                pass
        else:
            timestamp = _parse_generic_timestamp(str(ts_raw))

    # Normalize level
    level_raw = obj.get("level") or obj.get("severity") or obj.get("lvl")
    if level_raw:
        level = JSON_LEVEL_MAP.get(str(level_raw).lower(), "unknown")
    else:
        level = "unknown"

    # Message
    message_raw = obj.get("message") or obj.get("msg") or obj.get("text")
    if message_raw is not None:
        message = str(message_raw)
    else:
        # Stringify remaining fields if no message key
        remaining = {k: v for k, v in obj.items()
                     if k not in ("timestamp", "time", "ts", "@timestamp",
                                  "level", "severity", "lvl",
                                  "host", "hostname", "app", "service",
                                  "message", "msg", "text")}
        message = json.dumps(remaining) if remaining else ""

    # Host / app
    host = obj.get("host") or obj.get("hostname")
    app = obj.get("app") or obj.get("service") or obj.get("logger")

    return {
        "timestamp": timestamp,
        "level": level,
        "host": str(host) if host is not None else None,
        "app": str(app) if app is not None else None,
        "message": message,
        "raw": raw,
        "parse_error": None,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

PARSERS = {
    "syslog": parse_syslog,
    "nginx": parse_nginx,
    "json": parse_json_line,
}


def make_empty_line_record(raw: str) -> dict:
    return {
        "timestamp": None,
        "level": None,
        "host": None,
        "app": None,
        "message": None,
        "raw": raw,
        "parse_error": "empty line",
    }


def main():
    parser = argparse.ArgumentParser(description="Herald — structured log formatter")
    parser.add_argument("--format", required=True, help="Log format: syslog|nginx|json")
    parser.add_argument("--output", default=None, help="Output file path (default: stdout)")
    parser.add_argument("--strict", action="store_true",
                        help="Exit 1 if any parse error occurs")
    args = parser.parse_args()

    fmt = args.format.lower()
    if fmt not in PARSERS:
        print(f"Error: unknown format '{args.format}'. Choose from: syslog, nginx, json",
              file=sys.stderr)
        sys.exit(2)

    parse_fn = PARSERS[fmt]

    # Read all stdin
    try:
        lines = sys.stdin.read().splitlines()
    except Exception as e:
        print(f"Error reading stdin: {e}", file=sys.stderr)
        sys.exit(1)

    records = []
    had_error = False

    for line in lines:
        if line.strip() == "":
            record = make_empty_line_record(line)
            had_error = True
        else:
            record = parse_fn(line)
            if record.get("parse_error") is not None:
                had_error = True
        records.append(record)

    # Serialize
    output_lines = [json.dumps(r, ensure_ascii=False) for r in records]
    output_text = "\n".join(output_lines)
    if output_lines:
        output_text += "\n"

    # Write output
    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(output_text)
        except OSError as e:
            print(f"Error writing output file: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        sys.stdout.write(output_text)

    # Exit code
    if args.strict and had_error:
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
