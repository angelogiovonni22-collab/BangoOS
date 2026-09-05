from pathlib import Path

path = Path("lib/orion/autonomy/safe-read-executor.ts")
text = path.read_text()

import_anchor = 'import { verifyOrionAutonomousReadResult } from "./read-result-verifier";'
import_line = 'import { buildOrionReadEvidence, type OrionReadEvidence } from "./read-evidence";'
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit("read verifier import anchor not found")
    text = text.replace(import_anchor, import_anchor + "\n" + import_line, 1)

field_anchor = '  referencesResolved: number;\n};'
field_replacement = '  referencesResolved: number;\n  evidence: OrionReadEvidence | null;\n};'
if 'evidence: OrionReadEvidence | null;' not in text:
    if field_anchor not in text:
        raise SystemExit("execution step type anchor not found")
    text = text.replace(field_anchor, field_replacement, 1)

push_old = '''    executed.push({
      index: stepIndex,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
      referencesResolved: referenceResolution.referencesResolved,
    });

    if (!verified) {
'''
push_new = '''    const evidence = verified ? buildOrionReadEvidence(result) : null;
    executed.push({
      index: stepIndex,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
      referencesResolved: referenceResolution.referencesResolved,
      evidence,
    });

    if (!verified) {
'''
if 'const evidence = verified ? buildOrionReadEvidence(result) : null;' not in text:
    if push_old not in text:
        raise SystemExit("executed push anchor not found")
    text = text.replace(push_old, push_new, 1)

path.write_text(text)
