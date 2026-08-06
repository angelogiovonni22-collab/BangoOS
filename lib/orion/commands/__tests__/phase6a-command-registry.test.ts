import { createOrionCommandRouter, createOrionCommandRegistry } from "../index";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

type WorkflowInsertPayload = Record<string, unknown>;

type FakeSupabase = {
  workflowInserts: WorkflowInsertPayload[];
  from: (table: string) => {
    insert: (payload: WorkflowInsertPayload) => {
      select: (columns: string) => {
        single: () => Promise<{ data: { id: string } | null; error: null }>;
      };
    };
    select: (_columns: string) => {
      eq: (_column: string, _value: unknown) => {
        eq: (_column2: string, _value2: unknown) => {
          maybeSingle: () => Promise<{ data: { id: string; company_id: string } | null; error: null }>;
        };
      };
      order: (_column: string, _options: { ascending: boolean }) => {
        limit: (_count: number) => Promise<{ data: never[]; error: null }>;
      };
    };
  };
};

function createFakeSupabase(): FakeSupabase {
  const workflowInserts: WorkflowInsertPayload[] = [];

  function isUuid(value: unknown) {
    if (typeof value !== "string") {
      return false;
    }

    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  const emptyHistory = {
    async limit() {
      return { data: [], error: null };
    },
  };

  function createWorkflowSelectBuilder() {
    const filters = new Map<string, unknown>();

    const builder = {
      eq(column: string, value: unknown) {
        filters.set(column, value);
        return builder;
      },
      async maybeSingle() {
        const found = workflowInserts.find((entry) => {
          for (const [column, value] of filters.entries()) {
            if (entry[column] !== value) {
              return false;
            }
          }

          return true;
        });

        return {
          data: (found as { id: string; company_id: string } | undefined) || null,
          error: null,
        };
      },
      order() {
        return emptyHistory;
      },
    };

    return builder;
  }

  const profileEqChain = {
    eq() {
      return profileEqChain;
    },
    async maybeSingle() {
      return {
        data: { id: "profile-1", company_id: "company-1" },
        error: null,
      };
    },
  };

  return {
    workflowInserts,
    from(table: string) {
      if (table === "workflow_events") {
        return {
          insert(payload: WorkflowInsertPayload) {
            const referenceId = payload.reference_id;
            if (referenceId !== null && !isUuid(referenceId)) {
              throw new Error(`invalid input syntax for type uuid: \"${String(referenceId)}\"`);
            }

            workflowInserts.push(payload);
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: {
                        id: `wf-${workflowInserts.length}`,
                      },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          select() {
            return createWorkflowSelectBuilder();
          },
        };
      }

      if (table === "profiles") {
        return {
          insert() {
            throw new Error("not used");
          },
          select() {
            return {
              eq() {
                return profileEqChain;
              },
              order() {
                return {
                  async limit() {
                    return { data: [], error: null };
                  },
                };
              },
            };
          },
        };
      }

      return {
        insert() {
          throw new Error("not used");
        },
        select() {
          return {
            eq() {
              return createWorkflowSelectBuilder();
            },
            order() {
              return {
                async limit() {
                  return { data: [], error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

async function main() {
  await test("1. registry contains requested command IDs", () => {
    const registry = createOrionCommandRegistry();
    const ids = registry.list().map((item) => item.id);

    [
      "customer.open",
      "customer.create",
      "customer.update",
      "customer.archive",
      "customer.restore",
      "estimate.create",
      "estimate.open",
      "estimate.send",
      "estimate.approve",
      "estimate.decline",
      "estimate.convert",
      "estimate.generate_deposit_invoice",
      "project.create",
      "project.open",
      "project.update_status",
      "project.assign_crew",
      "project.complete",
      "project.archive",
      "invoice.create",
      "invoice.open",
      "invoice.send",
      "invoice.record_payment",
      "invoice.record_deposit",
      "invoice.issue_refund",
      "employee.create",
      "employee.open",
      "employee.assign",
      "employee.archive",
      "crew.create",
      "crew.open",
      "crew.assign",
      "crew.remove",
      "task.create",
      "task.complete",
      "task.assign",
      "daily_report.create",
      "daily_report.update",
      "daily_report.open",
      "schedule.open",
      "schedule.read_range",
      "dashboard.open",
      "navigation.back",
      "document.upload",
      "document.delete",
      "document.sign",
      "document.view",
    ].forEach((id) => {
      check(ids.includes(id), `${id} is registered`);
    });
  });

  await test("2. router resolves commands by name", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const result = await router.executeCommand({
      commandName: "Open Customer",
      params: {
        entityType: "customer",
        entityId: "cust-1",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "employee" },
    });

    check(result.success, "command name routes to handler");
    check(result.commandId === "customer.open", "resolved command id matches expected");
    check(result.status === "completed", "open command reports completed status");
    check(result.deepLink === "/customers/cust-1", "open command returns deep link");
  });

  await test("3. permission failures are deterministic", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const result = await router.executeCommand({
      commandId: "customer.archive",
      params: {
        customerId: "cust-1",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "employee" },
    });

    check(!result.success, "permission mismatch fails");
    check(result.status === "rejected", "permission mismatch is rejected");
    check(Boolean(result.failure), "permission failure returns message");
    check(Boolean(result.commandHistoryEventId), "permission failure is written to command history");
  });

  await test("4. validation failures include validation errors", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const result = await router.executeCommand({
      commandId: "task.create",
      params: {
        title: "",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "project_manager" },
    });

    check(!result.success, "missing required params fails validation");
    check(result.status === "failed", "validation failure status is failed");
    check(result.validationErrors.length > 0, "validation errors returned");
    check(Boolean(result.commandHistoryEventId), "validation failures are written to command history");
  });

  await test("5. confirmation-required commands reject when confirmation is missing", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const result = await router.executeCommand({
      commandId: "document.delete",
      params: {
        documentId: "doc-1",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "project_manager" },
    });

    check(!result.success, "missing confirmation rejects execution");
    check(result.status === "rejected", "missing confirmation returns rejected status");
    check(result.requiresConfirmation, "result requires confirmation");
    check(Boolean(result.commandHistoryEventId), "confirmation rejection is written to command history");
  });

  await test("6. unsupported commands return explicit unsupported status", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const result = await router.executeCommand({
      commandId: "document.delete",
      confirmation: true,
      params: {
        documentId: "doc-2",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "project_manager" },
    });

    check(result.success, "unsupported command still returns deterministic success envelope");
    check(result.status === "unsupported", "unsupported status is explicit");
    check((result.warnings || []).length > 0, "unsupported command includes warning details");
  });

  await test("7. command history writes canonical workflow.executed records", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    await router.executeCommand({
      commandId: "customer.open",
      params: {
        entityType: "customer",
        entityId: "cust-44",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "employee" },
      idempotencyKey: "phase6a-open-customer",
      correlationId: "phase6a-correlation",
    });

    check(fakeSupabase.workflowInserts.length > 0, "command history writes to workflow_events");
    const row = fakeSupabase.workflowInserts[0];
    check(row.event_type === "workflow.executed", "history event type is workflow.executed");
    check(row.reference_entity === "workflow", "history aggregate entity is workflow");
    check((row.payload as Record<string, unknown>).command_id === "customer.open", "history payload stores command id");
  });

  await test("8. command coverage metadata is present and no fallback executor remains", () => {
    const registry = createOrionCommandRegistry();
    const commands = registry.list();
    const navigation = commands.filter((item) => item.coverage.status === "navigation_only");
    const mutations = commands.filter((item) => item.coverage.status === "implemented");
    const required = commands.filter((item) => item.confirmationLevel === "REQUIRED");

    check(commands.every((item) => Boolean(item.coverage?.status)), "all commands declare coverage status");
    check(commands.every((item) => Boolean(item.requiredPermissions?.length)), "all commands declare permission metadata");
    check(commands.every((item) => Boolean(item.confirmationLevel)), "all commands declare confirmation level");
    check(navigation.every((item) => item.navigation?.resolvesHref), "all navigation commands resolve href");
    check(mutations.every((item) => item.eventContract?.expectedEvents?.length), "all mutation commands declare event contracts");

    const unsupportedIds = commands
      .filter((item) => item.coverage.status === "unsupported")
      .map((item) => item.id)
      .sort();

    check(
      JSON.stringify(unsupportedIds) === JSON.stringify([
        "daily_report.create",
        "daily_report.update",
        "document.delete",
        "document.sign",
        "document.upload",
        "invoice.issue_refund",
      ].sort()),
      "only commands with true missing dependencies are flagged unsupported",
    );

    const registrySource = readFileSync(resolve(process.cwd(), "lib", "orion", "commands", "registry.ts"), "utf8");
    check(!registrySource.includes("executeNotYetImplementedCommand"), "no command uses fallback executor");
    check(required.length > 0, "required-confirmation commands exist");
  });

  await test("9. REQUIRED commands are blocked without confirmation", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });
    const requiredCommands = createOrionCommandRegistry().list().filter((item) => item.confirmationLevel === "REQUIRED");

    for (const command of requiredCommands) {
      const params = command.id === "document.delete"
        ? { documentId: "doc-1" }
        : command.id === "document.sign"
          ? { documentId: "doc-1", signerName: "Signer" }
          : command.id === "invoice.issue_refund"
            ? { invoiceId: "inv-1", amount: 1, reason: "test" }
            : { entityType: "workflow", entityId: "x" };

      const result = await router.executeCommand({
        commandId: command.id,
        params,
        companyContext: { companyId: "company-1" },
        userContext: { actorProfileId: "profile-1", role: "owner" },
      });

      check(result.status === "rejected", `${command.id} rejects without confirmation`);
      check(result.requiresConfirmation, `${command.id} flags requiresConfirmation`);
    }
  });

  await test("10. navigation commands persist command history with nullable UUID reference", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const cases: Array<{ label: string; commandId: string; deepLink: string; params: Record<string, unknown> }> = [
      { label: "dashboard", commandId: "dashboard.open", deepLink: "/dashboard", params: { entityType: "workflow", entityId: "route-dashboard", deepLink: "/dashboard" } },
      { label: "timeline", commandId: "dashboard.open", deepLink: "/timeline", params: { entityType: "workflow", entityId: "route-timeline", deepLink: "/timeline" } },
      { label: "projects", commandId: "dashboard.open", deepLink: "/projects", params: { entityType: "workflow", entityId: "route-projects", deepLink: "/projects" } },
      { label: "schedule", commandId: "schedule.open", deepLink: "/schedule", params: { entityType: "schedule", entityId: "schedule", deepLink: "/schedule" } },
      { label: "back", commandId: "navigation.back", deepLink: "/dashboard", params: { fallbackHref: "/dashboard", navigationAction: "back" } },
    ];

    for (const item of cases) {
      const beforeCount = fakeSupabase.workflowInserts.length;
      const result = await router.executeCommand({
        commandId: item.commandId,
        params: item.params,
        companyContext: { companyId: "company-1" },
        userContext: { actorProfileId: "profile-1", role: "employee" },
        correlationId: `corr-${item.label}`,
        idempotencyKey: `idem-${item.label}`,
      });

      check(result.success, `${item.label} command executes successfully`);
      check(result.href === item.deepLink, `${item.label} navigation resolves expected href`);

      const afterCount = fakeSupabase.workflowInserts.length;
      check(afterCount === beforeCount + 1, `${item.label} writes one command history event`);

      const row = fakeSupabase.workflowInserts[afterCount - 1] as Record<string, unknown>;
      check(row.reference_id === null, `${item.label} stores null reference_id when no entity UUID exists`);
      check(row.company_id === "company-1", `${item.label} command history stays company scoped`);
      check(row.actor_profile_id === "profile-1", `${item.label} command history keeps actor attribution`);

      const payload = row.payload as Record<string, unknown>;
      check(typeof payload.command_id === "string", `${item.label} payload keeps textual command id`);
      check(payload.command_id === item.commandId, `${item.label} payload command id matches executed command`);
    }
  });

  await test("11. entity-backed command history preserves real entity UUID", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const entityId = "11111111-1111-4111-8111-111111111111";
    const result = await router.executeCommand({
      commandId: "project.open",
      params: {
        entityType: "project",
        entityId,
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "employee" },
      correlationId: "corr-project-open",
      idempotencyKey: "idem-project-open",
    });

    check(result.success, "project.open executes successfully");
    const row = fakeSupabase.workflowInserts[fakeSupabase.workflowInserts.length - 1] as Record<string, unknown>;
    check(row.reference_id === entityId, "entity-backed command keeps entity UUID in reference_id");
  });

  await test("12. invalid UUID values are normalized before workflow event persistence", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const result = await router.executeCommand({
      commandId: "project.open",
      params: {
        entityType: "project",
        entityId: "not-a-uuid",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "employee" },
      correlationId: "corr-invalid-uuid",
      idempotencyKey: "idem-invalid-uuid",
    });

    check(result.success, "project.open still executes when entity id is non-uuid text");
    const row = fakeSupabase.workflowInserts[fakeSupabase.workflowInserts.length - 1] as Record<string, unknown>;
    check(row.reference_id === null, "invalid entity identifier is not written into UUID reference_id");

    const payload = row.payload as Record<string, unknown>;
    check(payload.entity_id === "not-a-uuid", "payload preserves original entity identifier text");
  });

  await test("13. command history idempotency prevents duplicate workflow.executed rows", async () => {
    const fakeSupabase = createFakeSupabase();
    const router = createOrionCommandRouter({
      supabase: fakeSupabase as never,
    });

    const request = {
      commandId: "dashboard.open",
      params: {
        entityType: "workflow",
        entityId: "route-dashboard",
        deepLink: "/dashboard",
      },
      companyContext: { companyId: "company-1" },
      userContext: { actorProfileId: "profile-1", role: "employee" as const },
      correlationId: "corr-dup",
      idempotencyKey: "idem-dup",
    };

    await router.executeCommand(request);
    await router.executeCommand(request);

    check(fakeSupabase.workflowInserts.length === 1, "replayed command request does not create duplicate history event");
  });

  console.log(`\nPhase 6B command registry results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
