#!/usr/bin/env python3
"""Regenerate only the Denon blocks in the companion Flex launcher."""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("launcher", type=Path, help="Path to mods/startscreen/flex")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    updates = {}
    for target, filename, kind in (
        ("flex.js", "ui.js", "MODULE"),
        ("flex.css", "style.css", "STYLE"),
        ("flex.js", "sources.js", "SOURCES"),
    ):
        path = args.launcher / target
        text = updates[path] if path in updates else path.read_text(encoding="utf-8")
        begin = f"/* BEGIN FLEX DENON {kind} */"
        end = f"/* END FLEX DENON {kind} */"
        if text.count(begin) != 1 or text.count(end) != 1:
            raise ValueError(f"Expected exactly one {kind} block in {path}")
        before, remainder = text.split(begin)
        _, after = remainder.split(end)
        body = (source / filename).read_text(encoding="utf-8")
        updates[path] = before + begin + "\n" + body + "\n" + end + after
    for path, text in updates.items():
        if path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
