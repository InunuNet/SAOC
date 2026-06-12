#!/usr/bin/env python3
"""Chronos — deterministic job scheduler simulator (--now supplies all time)."""
import argparse, json, sys
from datetime import datetime


def parse_z(ts):
    if not isinstance(ts, str) or not ts.endswith("Z"):
        sys.exit(13)
    try:
        return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp())
    except ValueError:
        sys.exit(13)


def load_and_validate(jobs_path):
    with open(jobs_path) as f:
        jobs = json.load(f)
    for j in jobs:
        if int(j["interval_seconds"]) <= 0:
            sys.exit(14)
        if j["last_run"] is not None and not j["last_run"].endswith("Z"):
            sys.exit(13)
    return jobs


def cmd_plan(jobs_path, now_str):
    now_epoch = parse_z(now_str)
    jobs = load_and_validate(jobs_path)
    out = []
    for j in jobs:
        interval = int(j["interval_seconds"])
        skew = int(j["max_skew_seconds"])
        if j["last_run"] is None:
            out.append({"id": j["id"], "next_run": now_epoch,
                        "status": "due", "seconds_overdue": None})
            continue
        last = parse_z(j["last_run"])
        nxt = last + interval
        gap = now_epoch - last
        if gap > interval + skew:
            out.append({"id": j["id"], "next_run": nxt,
                        "status": "overdue", "seconds_overdue": gap - interval})
        else:
            out.append({"id": j["id"], "next_run": nxt,
                        "status": "ok", "seconds_overdue": None})
    out.sort(key=lambda r: (r["next_run"], r["id"]))
    print(json.dumps(out))
    return 0


def cmd_catchup(jobs_path, now_str, window):
    now_epoch = parse_z(now_str)
    jobs = load_and_validate(jobs_path)
    window_start = now_epoch - int(window)
    out = []
    for j in jobs:
        if j["last_run"] is None:
            continue
        anchor = parse_z(j["last_run"])
        interval = int(j["interval_seconds"])
        k_max = (now_epoch - anchor) // interval
        if k_max < 1:
            continue
        if window_start <= anchor:
            k_min = 1
        else:
            k_min = -(-(window_start - anchor) // interval)  # ceil division
            if k_min < 1:
                k_min = 1
        count = k_max - k_min + 1
        if count <= 0:
            continue
        if count > 1000:
            sys.exit(12)
        missed = [anchor + k * interval for k in range(k_min, k_max + 1)]
        out.append({"id": j["id"], "missed_runs": missed})
    print(json.dumps(out))
    return 0


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    pl = sub.add_parser("plan")
    pl.add_argument("--jobs", required=True)
    pl.add_argument("--now", required=True)
    ca = sub.add_parser("catchup")
    ca.add_argument("--jobs", required=True)
    ca.add_argument("--now", required=True)
    ca.add_argument("--window", required=True, type=int)
    args = p.parse_args()
    if args.cmd == "plan":
        sys.exit(cmd_plan(args.jobs, args.now))
    sys.exit(cmd_catchup(args.jobs, args.now, args.window))


if __name__ == "__main__":
    main()
