from pathlib import Path

executor_path = Path("lib/orion/autonomy/safe-read-executor.ts")
text = executor_path.read_text()
old = '''      verification = verifyOrionAutonomousReadResult({ command, result });
      if (verification.ok) break;
      if (!result.retryable || attempt >= MAX_SAFE_READ_ATTEMPTS) break;
'''
new = '''      verification = verifyOrionAutonomousReadResult({ command, result });
      if (verification.ok) break;
      const canRetry = !result.success && result.retryable && attempt < MAX_SAFE_READ_ATTEMPTS;
      if (!canRetry) break;
'''
if old not in text:
    raise SystemExit("retry safety anchor missing")
text = text.replace(old, new, 1)
old_fail = '''    const verified = verification.ok;
    const executedStep: OrionSafeReadExecutionStep = {
'''
new_fail = '''    const verified = verification.ok;
    const executedStep: OrionSafeReadExecutionStep = {
'''
if old_fail not in text:
    raise SystemExit("verification anchor missing")
executor_path.write_text(text)

contract_path = Path("lib/orion/autonomy/orion-safe-read-retry.contract.test.ts")
contract = contract_path.read_text()
contract = contract.replace(
'''  assert(executor.includes("result.retryable"), "only command results explicitly marked retryable can be retried");''',
'''  assert(executor.includes("!result.success && result.retryable"), "only explicitly retryable failed executions can be retried");''',
1,
)
contract = contract.replace(
'''  assert(executor.includes("if (!result.retryable || attempt >= MAX_SAFE_READ_ATTEMPTS) break"), "non-retryable failures fail closed immediately");''',
'''  assert(executor.includes("if (!canRetry) break"), "successful semantic mismatches and non-retryable failures fail closed instead of repeating side effects");''',
1,
)
contract_path.write_text(contract)
