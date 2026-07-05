#!/usr/bin/env python3
"""Weekly Claude-tokens-saved report from ~/.orchestrator/memory-work.jsonl.

Usage:
    python3 weekly_report.py [--days 7] [--file ~/.orchestrator/memory-work.jsonl]
"""
import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path


def parse_ts(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--file", default=str(Path.home() / ".orchestrator" / "memory-work.jsonl"))
    args = ap.parse_args()

    path = Path(args.file).expanduser()
    if not path.exists():
        print(f"No log at {path} — nothing routed yet.")
        return 1

    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    entries = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
            if parse_ts(e["ts"]) >= since:
                entries.append(e)
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            print(f"  [warn] skipping malformed line {i}: {exc}", file=sys.stderr)

    if not entries:
        print(f"No routed tasks in the last {args.days} days.")
        return 0

    total = len(entries)
    # Gemini-only: routed to Gemini and closed without Claude escalation.
    gemini_only = sum(
        1 for e in entries
        if e.get("route", "").startswith("gemini") and e.get("outcome") != "escalated"
    )
    saved = sum(int(e.get("claude_tokens_avoided", 0)) for e in entries)
    spent = sum(int(e.get("claude_tokens_spent", 0)) for e in entries)
    retries = sum(int(e.get("retries", 0)) for e in entries)

    by_route = Counter(e.get("route", "?") for e in entries)
    saved_by_route = defaultdict(int)
    for e in entries:
        saved_by_route[e.get("route", "?")] += int(e.get("claude_tokens_avoided", 0))

    print(f"orchestrate-work — last {args.days} days ({since.date()} → today)")
    print("=" * 56)
    print(f"Tasks routed:              {total}")
    print(f"Gemini-only (no Claude):   {gemini_only}  ({100 * gemini_only / total:.0f}%)")
    print(f"Gemini retries used:       {retries}")
    print(f"Claude tokens spent:       {spent:,}")
    print(f"Est. Claude tokens SAVED:  {saved:,}")
    print()
    print("By route:")
    for route, n in by_route.most_common():
        print(f"  {route:<24} {n:>4} tasks   saved ~{saved_by_route[route]:>10,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
