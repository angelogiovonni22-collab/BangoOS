#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re

ROOTS = [pathlib.Path("app"), pathlib.Path("components")]
PATTERN = re.compile(
    r"<Link\s+href=(?P<href>.+?)>\s*<IconButton(?P<attrs>[^>]*)/>\s*</Link>",
    re.DOTALL,
)
UI_IMPORT = re.compile(r'import\s*\{(?P<names>[^}]*)\}\s*from\s*["\']@/components/ui["\'];', re.DOTALL)


def ensure_icon_link_import(text: str) -> str:
    match = UI_IMPORT.search(text)
    if not match:
        return text
    names = [item.strip() for item in match.group("names").split(",") if item.strip()]
    if "IconLink" not in names:
        names.append("IconLink")
    if "<IconButton" not in text:
        names = [name for name in names if name != "IconButton"]
    replacement = 'import {\n  ' + ',\n  '.join(names) + ',\n} from "@/components/ui";'
    return text[:match.start()] + replacement + text[match.end():]


def transform(path: pathlib.Path) -> bool:
    original = path.read_text(encoding="utf-8")

    def repl(match: re.Match[str]) -> str:
        href = match.group("href").strip()
        return f'<IconLink href={href}{match.group("attrs")}/>'

    updated = PATTERN.sub(repl, original)
    if updated == original:
        return False
    updated = ensure_icon_link_import(updated)
    path.write_text(updated, encoding="utf-8")
    print(path.as_posix())
    return True


def main() -> int:
    changed = 0
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*.tsx"):
            changed += int(transform(path))
    print(f"Changed {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
