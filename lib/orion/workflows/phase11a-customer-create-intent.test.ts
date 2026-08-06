import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveVoiceWorkflowTurn } from "./voice-workflow-assistant";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, run: () => Promise<void>) {
  console.log(`\n${name}`);
  await run();
}

function workspace(userId: string): WorkspaceContext {
  return {
    userId,
    companyId: "company-1",
    role: "owner",
    companyName: "Bango",
    companySlug: null,
    membershipId: null,
    membershipStatus: null,
  };
}

function workspaceWithCompany(userId: string, companyId: string): WorkspaceContext {
  return {
    userId,
    companyId,
    role: "owner",
    companyName: "Bango",
    companySlug: null,
    membershipId: null,
    membershipStatus: null,
  };
}

function input(text: string) {
  return {
    input: text,
    route: {
      pathname: "/dashboard",
      projectId: null,
      customerId: null,
      estimateId: null,
      invoiceId: null,
      employeeId: null,
      crewId: null,
      dashboardWidgetId: null,
      timelineItemId: null,
    },
  };
}

async function main() {
  await test("1. add/create/new customer phrases start customer workflow without lookup", async () => {
    const phrases = [
      "add new customer",
      "create new customer",
      "create a customer",
      "add a customer",
      "new customer",
    ];

    for (let index = 0; index < phrases.length; index += 1) {
      let fromCalls = 0;
      const supabase = {
        from() {
          fromCalls += 1;
          throw new Error("customer lookup should not run at workflow start");
        },
      } as unknown as SupabaseClient<Database>;

      const result = await resolveVoiceWorkflowTurn({
        supabase,
        workspace: workspace(`user-create-${index}`),
        input: input(phrases[index]),
      });

      assert(result.handled, `${phrases[index]} is handled by voice workflow`);
      assert(result.statusCategory === "workflow_collecting", `${phrases[index]} enters collecting state`);
      assert(result.intent?.message.toLowerCase().includes("first name") ?? false, `${phrases[index]} asks for required create field`);
      assert(fromCalls === 0, `${phrases[index]} does not query customer matches`);
    }
  });

  await test("2. named create phrase captures proposed name in draft", async () => {
    const supabase = {
      from() {
        throw new Error("customer lookup should not run during customer.create field collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-named-create");

    const start = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create customer named Johnson Roofing"),
    });

    assert(start.handled, "named create phrase is workflow handled");
    assert(start.intent?.message.toLowerCase().includes("first name") ?? false, "named create phrase asks first required field");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Ada"),
    });

    const summary = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Stone"),
    });

    assert(summary.statusCategory === "workflow_awaiting_confirmation", "workflow reaches confirmation after required fields");
    assert(summary.intent?.message.toLowerCase().includes("company: johnson roofing") ?? false, "named create phrase preserves proposed customer name in draft summary");
  });

  await test("3. update/open customer phrases are not captured as create workflow", async () => {
    const supabase = {
      from() {
        throw new Error("no query expected in workflow pre-check for update/open phrases");
      },
    } as unknown as SupabaseClient<Database>;

    const update = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspace("user-update"),
      input: input("update customer Johnson Roofing"),
    });
    const open = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspace("user-open"),
      input: input("open customer Johnson Roofing"),
    });

    assert(!update.handled, "update customer phrase falls through to shared intent resolver path");
    assert(!open.handled, "open customer phrase falls through to shared intent resolver path");
  });

  await test("4. explicit create new customer replaces stale awaiting-confirmation session", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-stale-restart-confirmation");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Ada"),
    });
    const staleSummary = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Stone"),
    });
    assert(staleSummary.statusCategory === "workflow_awaiting_confirmation", "baseline session reaches awaiting confirmation");

    const restarted = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });

    assert(restarted.statusCategory === "workflow_collecting", "explicit create new customer restarts into collecting");
    assert(restarted.intent?.message.toLowerCase().includes("first name") ?? false, "restarted session asks first required field");
  });

  await test("5. explicit add new customer replaces stale partial session", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-stale-restart-partial");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Ada"),
    });

    const restarted = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("add new customer"),
    });

    assert(restarted.statusCategory === "workflow_collecting", "explicit add new customer restarts into collecting");
    assert(restarted.intent?.message.toLowerCase().includes("first name") ?? false, "restarted partial session resets to first field");
  });

  await test("6. named create replaces stale draft and seeds only new company name", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-stale-named-replace");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create customer named Old Company"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Ada"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Stone"),
    });

    const restarted = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create customer named Johnson Roofing"),
    });
    assert(restarted.statusCategory === "workflow_collecting", "named create restarts session into collecting");
    assert(restarted.intent?.message.toLowerCase().includes("first name") ?? false, "named create restart asks first required field");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Lena"),
    });
    const summary = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Flores"),
    });

    const message = summary.intent?.message.toLowerCase() || "";
    assert(message.includes("company: johnson roofing"), "summary keeps only the newly provided named company");
    assert(!message.includes("old company"), "summary does not carry stale company values");
  });

  await test("7. start over resets active customer.create workflow to fresh draft", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-start-over");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Ada"),
    });

    const restarted = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("start over"),
    });

    assert(restarted.statusCategory === "workflow_collecting", "start over returns workflow to collecting");
    assert(restarted.intent?.message.toLowerCase().includes("first name") ?? false, "start over resets to first required field");
  });

  await test("8. yes still confirms a true awaiting-confirmation workflow", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow confirmation");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-confirm-yes");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Ada"),
    });
    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("Stone"),
    });

    const confirmed = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("yes"),
    });

    assert(confirmed.statusCategory === "workflow_ready_to_execute", "yes confirms when awaiting confirmation");
    assert(confirmed.intent?.suggestedCommand?.commandId === "customer.create", "confirmation still resolves customer.create command");
  });

  await test("9. cancel clears active session", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-cancel-clear");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });

    const canceled = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("cancel"),
    });
    assert(canceled.statusCategory === "workflow_canceled", "cancel returns canceled status");

    const afterCancel = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("5551234567"),
    });
    assert(!afterCancel.handled, "session is cleared after cancel and no longer consumes arbitrary input");
  });

  await test("10. session isolation remains scoped by user and company", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for customer.create workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspaceWithCompany("shared-user", "company-a"),
      input: input("create new customer"),
    });

    const otherCompany = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspaceWithCompany("shared-user", "company-b"),
      input: input("Ada"),
    });
    assert(!otherCompany.handled, "same user in a different company does not reuse active session");

    const otherUser = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspaceWithCompany("other-user", "company-a"),
      input: input("Ada"),
    });
    assert(!otherUser.handled, "different user in same company does not reuse active session");
  });

  await test("11. other workflow types are not cleared by customer explicit restart phrases", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for project workflow collection");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-other-workflow");

    await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new project"),
    });

    const continuedProject = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: actor,
      input: input("create new customer"),
    });

    assert(continuedProject.handled, "project workflow remains active and handles the turn");
    assert(continuedProject.statusCategory !== "workflow_not_enabled", "project workflow does not get replaced by unrelated workflow state");

    const commandId = continuedProject.intent?.suggestedCommand?.commandId;
    assert(commandId !== "customer.create", "project workflow does not switch to customer.create command");

    const message = continuedProject.intent?.message.toLowerCase() || "";
    assert(!message.includes("first name"), "project workflow response is not customer.create field collection");
  });

  await test("12. timeout behavior remains unchanged", async () => {
    const supabase = {
      from() {
        throw new Error("no lookup expected for timeout test");
      },
    } as unknown as SupabaseClient<Database>;

    const actor = workspace("user-timeout");
    const originalNow = Date.now;
    let now = 1_000_000;

    Date.now = () => now;

    try {
      await resolveVoiceWorkflowTurn({
        supabase,
        workspace: actor,
        input: input("create new customer"),
      });

      now += (8 * 60_000) + 1;

      const afterTimeout = await resolveVoiceWorkflowTurn({
        supabase,
        workspace: actor,
        input: input("Ada"),
      });

      assert(!afterTimeout.handled, "expired session no longer consumes input after timeout window");
    } finally {
      Date.now = originalNow;
    }
  });

  await test("13. update/open/archive phrases still fall through shared resolver path", async () => {
    const supabase = {
      from() {
        throw new Error("no query expected for non-create phrase pre-check");
      },
    } as unknown as SupabaseClient<Database>;

    const update = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspace("user-update-still-falls-through"),
      input: input("update customer Johnson Roofing"),
    });
    const open = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspace("user-open-still-falls-through"),
      input: input("open customer Johnson Roofing"),
    });
    const archive = await resolveVoiceWorkflowTurn({
      supabase,
      workspace: workspace("user-archive-still-falls-through"),
      input: input("archive customer Johnson Roofing"),
    });

    assert(!update.handled, "update still falls through to shared intent resolver path");
    assert(!open.handled, "open still falls through to shared intent resolver path");
    assert(!archive.handled, "archive still falls through to shared intent resolver path");
  });

  console.log(`\nPhase 11A customer create voice intent results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
