#!/usr/bin/env python3
"""Convert WEBVTT subtitle file to clean plain text.

YouTube auto-caption VTTs have a peculiar shape: the captions "scroll", so
each cue contains the previous line as a static header *plus* a new word
stream with progressive timing tags. The same text appears many times across
adjacent cues. We collapse this back to a flat reading transcript by
exploiting overlap between consecutive cues — for each new cue, we only keep
the part that's not already at the end of what we've accumulated.

Usage:
    vtt_to_text.py <input.vtt>            # prints clean text to stdout
    vtt_to_text.py <input.vtt> --json     # also emits cues as JSON to stderr
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Note: mlx_whisper emits VTT with MM:SS.mmm (no hours); YouTube emits with
# HH:MM:SS.mmm. Accept both shapes everywhere we match a timestamp.
TIMING_TAG = re.compile(r"<(?:\d{2}:)?\d{2}:\d{2}\.\d{3}>")
CTAG = re.compile(r"</?c[^>]*>")
TIMESTAMP_LINE = re.compile(
    r"^(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2}:)?\d{2}:\d{2}\.\d{3}"
)


def parse_cues(path: Path) -> list[dict]:
    """Parse a VTT into a list of {start, end, text} cues, with text cleaned."""
    raw = path.read_text(encoding="utf-8", errors="replace")
    cues: list[dict] = []
    cue_start: str | None = None
    cue_end: str | None = None
    cue_lines: list[str] = []

    def flush() -> None:
        nonlocal cue_start, cue_end, cue_lines
        if cue_start is not None and cue_lines:
            text = " ".join(line for line in cue_lines if line).strip()
            text = re.sub(r"\s+", " ", text)
            if text:
                cues.append({"start": cue_start, "end": cue_end, "text": text})
        cue_start = cue_end = None
        cue_lines = []

    for raw_line in raw.splitlines():
        line = raw_line.rstrip("\r")
        stripped = line.strip()
        if not stripped:
            flush()
            continue
        upper = stripped.upper()
        if (
            upper.startswith("WEBVTT")
            or stripped.startswith("Kind:")
            or stripped.startswith("Language:")
            or stripped.startswith("NOTE")
        ):
            continue
        m = TIMESTAMP_LINE.match(stripped)
        if m:
            flush()
            parts = stripped.split(" --> ")
            cue_start = parts[0]
            cue_end = parts[1].split(" ")[0]
            continue
        if cue_start is None:
            continue
        cleaned = TIMING_TAG.sub("", line).strip()
        cleaned = CTAG.sub("", cleaned).strip()
        if cleaned:
            cue_lines.append(cleaned)
    flush()
    return cues


def merge_cues(cues: list[dict]) -> str:
    """Merge cue texts, removing prefix overlap with the running output.

    For each cue, find the longest suffix of the running output that is also a
    prefix of the cue's text — that's already on the page, so we only append
    the remainder. Handles both auto-captions (heavy overlap) and manual subs
    (no overlap; cues just concatenate).
    """
    output = ""
    for cue in cues:
        text = cue["text"]
        if not text:
            continue
        if text in output:
            continue
        overlap = _max_overlap(output, text)
        novel = text[overlap:].lstrip()
        if not novel:
            continue
        sep = "" if (not output or output.endswith((" ", "\n"))) else " "
        output += sep + novel
    return re.sub(r"\s+", " ", output).strip()


def merge_cues_with_timestamps(cues: list[dict]) -> str:
    """Like merge_cues, but emits one line per surviving cue prefixed with
    its start timestamp in [HH:MM:SS] format. Drops cues that contribute no
    novel content.
    """
    lines: list[str] = []
    running = ""
    for cue in cues:
        text = cue["text"]
        if not text:
            continue
        if text in running:
            continue
        overlap = _max_overlap(running, text)
        novel = text[overlap:].lstrip()
        if not novel:
            continue
        ts = _format_timestamp(cue.get("start", ""))
        lines.append(f"[{ts}] {novel}")
        sep = "" if (not running or running.endswith((" ", "\n"))) else " "
        running += sep + novel
    return "\n".join(lines)


def _format_timestamp(raw: str) -> str:
    """Normalize timestamps:
    - 'HH:MM:SS.mmm' → 'HH:MM:SS', or 'MM:SS' if hours are zero (YouTube VTT)
    - 'MM:SS.mmm'    → 'MM:SS' (mlx_whisper VTT)
    """
    if not raw:
        return "00:00"
    base = raw.split(".")[0]
    parts = base.split(":")
    if len(parts) == 3 and parts[0] == "00":
        return f"{parts[1]}:{parts[2]}"
    return base


def _max_overlap(haystack: str, candidate: str) -> int:
    """Largest k such that haystack ends with candidate[:k]."""
    if not haystack or not candidate:
        return 0
    window = haystack[-(len(candidate) + 8):]
    max_k = min(len(candidate), len(window))
    for k in range(max_k, 0, -1):
        if window.endswith(candidate[:k]):
            return k
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean a VTT into readable text.")
    parser.add_argument("vtt", type=Path, help="Path to .vtt file")
    parser.add_argument("--with-timestamps", action="store_true",
                        help="Emit one line per cue prefixed with [HH:MM:SS] (or [MM:SS])")
    parser.add_argument("--json", action="store_true", help="Emit cues as JSON to stderr")
    args = parser.parse_args()

    if not args.vtt.exists():
        print(f"VTT file not found: {args.vtt}", file=sys.stderr)
        return 1

    cues = parse_cues(args.vtt)
    if args.with_timestamps:
        print(merge_cues_with_timestamps(cues))
    else:
        print(merge_cues(cues))
    if args.json:
        json.dump(cues, sys.stderr, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main())
