#!/usr/bin/env python3
"""Replace invalid Next Link > Button nesting with one styled Link control."""
from __future__ import annotations

import pathlib
import re

ROOTS = [pathlib.Path("app"), pathlib.Path("components")]
LINK_BUTTON = re.compile(
    r"<Link(?P<linkattrs>[^>]*)>\s*<Button(?P<buttonattrs>[^>]*)>(?P<children>.*?)</Button>\s*</Link>",
    re.DOTALL,
)
UI_IMPORT = re.compile(r'import\s*\{(?P<names>[^}]*)\}\s*from\s*["\']@/components/ui["\'];', re.DOTALL)
BUTTON_IMPORT = re.compile(r'import\s*\{(?P<names>[^}]*)\}\s*from\s*["\']@/components/ui/button["\'];', re.DOTALL)
DISALLOWED_BUTTON_ATTRS = re.compile(r"\b(on[A-Z]\w*|disabled|type|form|name|value|aria-|data-)\s*=")


def option_from(attrs: str, name: str) -> str | None:
    match = re.search(rf'\b{name}=["\']([^"\']+)["\']', attrs)
    return match.group(1) if match else None


def ensure_helper_import(text: str) -> str:
    if "getButtonClassName" in text:
        return text

    for pattern in (UI_IMPORT, BUTTON_IMPORT):
        match = pattern.search(text)
        if not match:
            continue
        names = match.group("names")
        entries = [item.strip() for item in names.split(",") if item.strip()]
        if "getButtonClassName" not in entries:
            entries.append("getButtonClassName")
        replacement = 'import { ' + ", ".join(entries) + ' } from "' + ("@/components/ui/button" if pattern is BUTTON_IMPORT else "@/components/ui") + '";'
        return text[: match.start()] + replacement + text[match.end() :]

    return text


def remove_unused_button_import(text: str) -> str:
    if "<Button" in text:
        return text
    for pattern in (UI_IMPORT, BUTTON_IMPORT):
        match = pattern.search(text)
        if not match:
            continue
        entries = [item.strip() for item in match.group("names").split(",") if item.strip() and item.strip() != "Button"]
        replacement = 'import { ' + ", ".join(entries) + ' } from "' + ("@/components/ui/button" if pattern is BUTTON_IMPORT else "@/components/ui") + '";'
        text = text[: match.start()] + replacement + text[match.end() :]
    return text


def transform_file(path: pathlib.Path) -> bool:
    original = path.read_text(encoding="utf-8")
    transformed_any = False

    def replace(match: re.Match[str]) -> str:
        nonlocal transformed_any
        linkattrs = match.group("linkattrs")
        buttonattrs = match.group("buttonattrs")
        children = match.group("children").strip()

        if "className=" in linkattrs or DISALLOWED_BUTTON_ATTRS.search(buttonattrs):
            return match.group(0)

        variant = option_from(buttonattrs, "variant")
        size = option_from(buttonattrs, "size")
        options: list[str] = []
        if variant:
            options.append(f'variant: "{variant}"')
        if size:
            options.append(f'size: "{size}"')
        option_expr = "{ " + ", ".join(options) + " }" if options else "{}"
        transformed_any = True
        return f'<Link{linkattrs} className={{getButtonClassName({option_expr})}}>{children}</Link>'

    updated = LINK_BUTTON.sub(replace, original)
    if not transformed_any:
        return False

    updated = ensure_helper_import(updated)
    updated = remove_unused_button_import(updated)
    path.write_text(updated, encoding="utf-8")
    print(path.as_posix())
    return True


def main() -> int:
    changed = 0
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*.tsx"):
            changed += int(transform_file(path))
    print(f"Changed {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
