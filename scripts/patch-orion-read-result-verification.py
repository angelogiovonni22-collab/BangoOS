from pathlib import Path

path = Path("lib/orion/autonomy/safe-read-executor.ts")
text = path.read_text()

import_anchor = 'import { resolveOrionStepReferences, type OrionStepReferenceOutput } from "./step-references";'
import_line = 'import { verifyOrionAutonomousReadResult } from "./read-result-verifier";'
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit("safe-read executor import anchor not found")
    text = text.replace(import_anchor, import_anchor + "\n" + import_line, 1)

old = '''    const verified = result.success && result.status === "completed";
    executed.push({
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
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "execution_failed", nextBlockedStep: planned.plan.nextBlockedStep, error: result.userMessage });
    }
'''
new = '''    const verification = verifyOrionAutonomousReadResult({ command, result });
    const verified = verification.ok;
    const verificationError = verification.ok ? result.userMessage : verification.reason;
    executed.push({
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
      return emptyResult({ ok: false, executed, stoppedAt: stepIndex, stopReason: "execution_failed", nextBlockedStep: planned.plan.nextBlockedStep, error: verificationError });
    }
'''
if "verifyOrionAutonomousReadResult({ command, result })" not in text:
    if old not in text:
        raise SystemExit("safe-read executor verification anchor not found")
    text = text.replace(old, new, 1)

path.write_text(text)
