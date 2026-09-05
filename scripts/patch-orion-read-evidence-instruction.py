from pathlib import Path

path = Path("app/api/orion/realtime/session/route.ts")
text = path.read_text()
anchor = '        `Multi-step autonomy policy:'
lines = text.splitlines()
if not any("Verified read evidence policy:" in line for line in lines):
    for index, line in enumerate(lines):
        if anchor in line:
            lines.insert(index + 1, '        "Verified read evidence policy: after orion_autonomy_safe_read returns, answer from executed[].evidence as the source of truth for completed read steps. Evidence is bounded and secret-key filtered. If evidence.truncated is true and the user needs more detail, perform a narrower canonical read instead of guessing.",')
            break
    else:
        raise SystemExit("multi-step policy instruction anchor not found")
    path.write_text("\n".join(lines) + "\n")
