from pathlib import Path

bridge_path = Path("lib/orion/realtime/tool-bridge.ts")
bridge = bridge_path.read_text()
old_payload = '''    stopReason?: unknown;
    nextBlockedStep?: unknown;
  };'''
new_payload = '''    stopReason?: unknown;
    nextBlockedStep?: unknown;
    nextBlockedAction?: unknown;
  };'''
if "nextBlockedAction?: unknown" not in bridge:
    if old_payload not in bridge:
        raise SystemExit("bridge payload anchor not found")
    bridge = bridge.replace(old_payload, new_payload, 1)
old_detail = '''      stopReason: payload.stopReason ?? null,
      nextBlockedStep: payload.nextBlockedStep ?? null,
    },'''
new_detail = '''      stopReason: payload.stopReason ?? null,
      nextBlockedStep: payload.nextBlockedStep ?? null,
      nextBlockedAction: payload.nextBlockedAction ?? null,
    },'''
if "nextBlockedAction: payload.nextBlockedAction ?? null" not in bridge:
    if old_detail not in bridge:
        raise SystemExit("bridge detail anchor not found")
    bridge = bridge.replace(old_detail, new_detail, 1)
bridge_path.write_text(bridge)

session_path = Path("app/api/orion/realtime/session/route.ts")
session = session_path.read_text()
anchor = '        "Read-chain policy: when a later read depends on the verified result of an earlier read in the same safe sequence, use an exact $step.N output reference instead of guessing or inventing an id. Only reference an earlier step, and use the reference as the entire parameter value so BOS can preserve the original value type.",'
instruction = '        "Protected-boundary handoff policy: if the safe-read tool returns nextBlockedAction, call exactly that returned canonical toolName with exactly the returned params. Treat that as a handoff into the normal BOS command path and never bypass its review or confirmation response. If no nextBlockedAction is returned, do not bypass the boundary or the eight-step unattended limit.",'
if "Protected-boundary handoff policy:" not in session:
    if anchor not in session:
        raise SystemExit("session read-chain anchor not found")
    session = session.replace(anchor, anchor + "\n" + instruction, 1)
session_path.write_text(session)

workflow_path = Path(".github/workflows/orion-autonomy.yml")
workflow = workflow_path.read_text()
contract_anchor = '      - run: npx -y tsx lib/orion/autonomy/orion-step-references.contract.test.ts\n'
contract_line = '      - run: npx -y tsx lib/orion/autonomy/orion-protected-boundary-handoff.contract.test.ts\n'
if contract_line not in workflow:
    if contract_anchor not in workflow:
        raise SystemExit("autonomy workflow anchor not found")
    workflow = workflow.replace(contract_anchor, contract_anchor + contract_line, 1)
workflow_path.write_text(workflow)
