from pathlib import Path

path = Path("app/api/orion/realtime/session/route.ts")
text = path.read_text()
old_description = 'description: "Plan and execute only the read-only prefix of an ordered multi-step BOS request. Every step must name an existing canonical BOS tool and its params. This tool re-plans and re-authorizes server-side, executes at most eight read-risk steps, verifies each result, and stops before every write, external effect, financial, destructive, or legal/authority action. Never use it to bypass normal canonical BOS confirmation controls.",'
new_description = 'description: "Plan and execute only the read-only prefix of an ordered multi-step BOS request. Every step must name an existing canonical BOS tool and its params. Later read steps may consume verified output from an earlier step by using an exact whole-value reference such as $step.1.entityId, $step.1.href, or $step.1.details.projectId. This tool re-plans and re-authorizes server-side, executes at most eight read-risk steps, verifies each result, and stops before every write, external effect, financial, destructive, or legal/authority action. Never use it to bypass normal canonical BOS confirmation controls.",'
if old_description not in text:
    raise SystemExit("safe-read description anchor not found")
text = text.replace(old_description, new_description, 1)

old_params = 'params: { type: "object", additionalProperties: true, description: "Parameters for that canonical BOS tool." },'
new_params = 'params: { type: "object", additionalProperties: true, description: "Parameters for that canonical BOS tool. A whole parameter value may reference a verified earlier read result using $step.N.entityId, $step.N.href, $step.N.createdEntityIds.0, $step.N.updatedEntityIds.0, or $step.N.details.someField. References may only point backward to completed steps and fail closed if missing." },'
if old_params not in text:
    raise SystemExit("safe-read params anchor not found")
text = text.replace(old_params, new_params, 1)

instruction_anchor = '        `Multi-step autonomy policy: when a user asks for an ordered task containing two or more BOS lookups/reads, or a larger task whose first steps are reads, call ${AUTONOMY_SAFE_READ_TOOL_NAME} with those canonical bos_* tool calls in order. It may execute only the verified read-only prefix and will stop before every non-read step. Never bypass a returned boundary: continue any write or protected step only through its normal canonical BOS tool so existing review and confirmation controls remain authoritative.`,'
instruction = '        "Read-chain policy: when a later read depends on the verified result of an earlier read in the same safe sequence, use an exact $step.N output reference instead of guessing or inventing an id. Only reference an earlier step, and use the reference as the entire parameter value so BOS can preserve the original value type.",'
if "Read-chain policy:" not in text:
    if instruction_anchor not in text:
        raise SystemExit("multi-step instruction anchor not found")
    text = text.replace(instruction_anchor, instruction_anchor + "\n" + instruction, 1)

path.write_text(text)
