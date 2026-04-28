#!/usr/bin/env python3
"""Assemble the final transcript markdown with YAML frontmatter.

Given a metadata JSON blob and a transcript text file, produces the canonical
markdown note used both in /tmp/transcripts/ and in the Obsidian vault.

Usage:
    build_note.py --meta meta.json --transcript transcript.txt --out transcript.md
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def fmt_duration(seconds: float | int | None) -> str:
    if not seconds:
        return ""
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def yaml_escape(value: str) -> str:
    """Quote a string only if needed for YAML safety."""
    if value is None:
        return ""
    s = str(value)
    if any(ch in s for ch in ":#'\"\n[]{},&*!|>%@`") or s.strip() != s:
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def build(meta: dict, transcript: str) -> str:
    extracted_at = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
    fm: list[str] = ["---"]
    fm.append(f"title: {yaml_escape(meta.get('title', ''))}")
    fm.append(f"url: {yaml_escape(meta.get('url', ''))}")
    fm.append(f"video_id: {yaml_escape(meta.get('id', ''))}")
    fm.append(f"platform: {yaml_escape(meta.get('platform', ''))}")
    fm.append(f"uploader: {yaml_escape(meta.get('uploader', ''))}")
    fm.append(f"duration: {yaml_escape(fmt_duration(meta.get('duration')))}")
    fm.append(f"language: {yaml_escape(meta.get('language', ''))}")
    fm.append(f"source: {yaml_escape(meta.get('source', ''))}  # captions | audio")
    if meta.get("upload_date"):
        fm.append(f"upload_date: {yaml_escape(meta['upload_date'])}")
    fm.append(f"extracted_at: {yaml_escape(extracted_at)}")
    fm.append("tags: [transcript]")
    fm.append("---")

    body: list[str] = []
    body.append(f"# {meta.get('title', 'Untitled')}\n")
    body.append(f"**URL:** {meta.get('url', '')}  ")
    body.append(f"**Uploader:** {meta.get('uploader', '')}  ")
    body.append(f"**Duration:** {fmt_duration(meta.get('duration'))}  ")
    body.append(f"**Source:** {meta.get('source', '')}  ")
    if meta.get("language"):
        body.append(f"**Language:** {meta.get('language')}  ")
    body.append("")
    body.append("## Transcript")
    body.append("")
    body.append(transcript.strip())
    body.append("")

    return "\n".join(fm) + "\n\n" + "\n".join(body)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build transcript markdown with YAML frontmatter.")
    parser.add_argument("--meta", type=Path, required=True, help="Path to metadata JSON")
    parser.add_argument("--transcript", type=Path, required=True, help="Path to transcript .txt")
    parser.add_argument("--out", type=Path, required=True, help="Output .md path")
    args = parser.parse_args()

    meta = json.loads(args.meta.read_text(encoding="utf-8"))
    transcript = args.transcript.read_text(encoding="utf-8")
    md = build(meta, transcript)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(md, encoding="utf-8")
    print(str(args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
