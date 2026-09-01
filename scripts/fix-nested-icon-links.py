#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re

ROOTS = [pathlib.Path("app"), pathlib.Path("components")]
PATTERN = re.compile(
    r'<Link\s+href=(?P<href>.*?)>\s*<IconButton\s+icon=\{(?P<icon><.*?/>)\}\s+label=(?P<label>\{[^}]+\}|"[^"]+")\s+variant="(?P<variant>[^"]+)"\s+size="(?P<size>[^"]+)"\s*/>\s*</Link>',
    re.DOTALL,
)
UI_IMPORT = re.compile(r'import\s*\{(?P<names>[^}]*)\}\s*from\s*["\']@/components/ui["\'];', re.DOTALL)
NEXT_LINK_IMPORT = 'import Link from "next/link";\n'
TRADE_PARTNER_PATH = pathlib.Path("components/projects/workspace/project-trade-partners-workspace.tsx")
TRADE_PARTNER_OLD = '<Link href={`/vendors/${assignment.vendorId}`}><Button type="button" variant="outline" className="w-full">View Trade Partner<ArrowUpRight size={14} /></Button></Link>'
TRADE_PARTNER_NEW = '<Link href={`/vendors/${assignment.vendorId}`} className={`${getButtonClassName({ variant: "outline" })} w-full`}>View Trade Partner<ArrowUpRight size={14} /></Link>'


def update_ui_import(text: str, add: set[str] | None = None, remove: set[str] | None = None) -> str:
    match = UI_IMPORT.search(text)
    if not match:
        return text
    names = [item.strip() for item in match.group("names").split(",") if item.strip()]
    for name in add or set():
        if name not in names:
            names.append(name)
    names = [name for name in names if name not in (remove or set())]
    replacement = 'import {\n  ' + ',\n  '.join(names) + ',\n} from "@/components/ui";'
    return text[:match.start()] + replacement + text[match.end():]


def transform(path: pathlib.Path) -> bool:
    original = path.read_text(encoding="utf-8")

    def repl(match: re.Match[str]) -> str:
        return (
            f'<IconLink href={match.group("href").strip()} '
            f'icon={{{match.group("icon")}}} label={match.group("label")} '
            f'variant="{match.group("variant")}" size="{match.group("size")}" />'
        )

    updated = PATTERN.sub(repl, original)
    if updated != original:
        updated = update_ui_import(updated, add={"IconLink"}, remove={"IconButton"} if "<IconButton" not in updated else set())

    if path == TRADE_PARTNER_PATH and TRADE_PARTNER_OLD in updated:
        updated = updated.replace(TRADE_PARTNER_OLD, TRADE_PARTNER_NEW)
        updated = update_ui_import(updated, add={"getButtonClassName"})

    if NEXT_LINK_IMPORT in updated and "<Link" not in updated:
        updated = updated.replace(NEXT_LINK_IMPORT, "", 1)

    if updated == original:
        return False

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
