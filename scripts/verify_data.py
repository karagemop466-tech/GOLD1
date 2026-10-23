#!/usr/bin/env python3
"""Compatibility entry point for the canonical GOLD1 anti-hallucination audit.

The former Python audit targeted a retired dataset schema and could fail with a
misleading KeyError against the current data. Keep this historical command
usable, but delegate all checks to the maintained canonical verifier:

    python3 scripts/verify_data.py

Equivalent to: node scripts/verify.mjs
This wrapper performs no network requests and does not verify that external
seller pages are still live; the audit report records the age of captured data.
"""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
NODE_VERIFIER = ROOT / "scripts" / "verify.mjs"


def main() -> int:
    node = shutil.which("node")
    if node is None:
        print("ERROR: Node.js is required to run scripts/verify.mjs", file=sys.stderr)
        return 2
    print("Compatibility command: running canonical scripts/verify.mjs")
    return subprocess.run([node, str(NODE_VERIFIER)], cwd=ROOT, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
