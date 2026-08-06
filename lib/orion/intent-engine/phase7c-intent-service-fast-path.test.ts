import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { resolveOrionIntent } from "./service";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function test(name: string, run: () => Promise<void>) {
  console.log(`\n${name}`);
  return run();
}

function buildWorkspace(): WorkspaceContext {
  return {
    userId: "user-1",
    companyId: "company-1",
    role: "owner",
    companyName: "Bango",
    companySlug: null,
    membershipId: null,
    membershipStatus: null,
  };
}

function buildInput(input: string) {
  return {
    input,
    route: {
      pathname: "/operations",
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
  await test("1. deterministic navigation fast path avoids entity queries", async () => {
    let fromCalls = 0;

    const supabase = {
      from() {
        fromCalls += 1;
        throw new Error("entity query should not run for deterministic navigation fast path");
      },
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrionIntent({
      supabase,
      workspace: buildWorkspace(),
      input: buildInput("open timeline"),
    });

    assert(result.suggestedCommand?.commandId === "dashboard.open", "fast path still maps to a command-registry navigation command");
    assert(result.suggestedCommand?.params.deepLink === "/timeline", "fast path still resolves deterministic deep link");
    assert(fromCalls === 0, "no entity table query is executed for deterministic navigation");
  });

  await test("2. operations phrase uses deterministic fast path", async () => {
    let fromCalls = 0;

    const supabase = {
      from() {
        fromCalls += 1;
        throw new Error("entity query should not run for deterministic navigation fast path");
      },
    } as unknown as SupabaseClient<Database>;

    const result = await resolveOrionIntent({
      supabase,
      workspace: buildWorkspace(),
      input: buildInput("open operations"),
    });

    assert(result.suggestedCommand?.commandId === "dashboard.open", "operations phrase maps to dashboard.open command");
    assert(result.suggestedCommand?.params.deepLink === "/operations", "operations fast path resolves operations deep link");
    assert(fromCalls === 0, "operations deterministic phrase skips entity table queries");
  });

  await test("3. wake-prefixed deterministic phrases skip entity lookup", async () => {
    const checks = [
      { phrase: "Hey Orion, open dashboard", commandId: "dashboard.open", deepLink: "/dashboard" },
      { phrase: "Hey Orion, go back", commandId: "navigation.back", deepLink: "/dashboard" },
      { phrase: "Orion, open timeline", commandId: "dashboard.open", deepLink: "/timeline" },
      { phrase: "Okay Orion, show projects", commandId: "dashboard.open", deepLink: "/projects" },
      { phrase: "Hey Orion, open customers", commandId: "dashboard.open", deepLink: "/customers" },
      { phrase: "Orion, show estimates", commandId: "dashboard.open", deepLink: "/estimates" },
      { phrase: "Hey Orion, show today's schedule", commandId: "schedule.read_range", deepLink: null },
      { phrase: "Orion, open dispatch center", commandId: "dashboard.open", deepLink: "/dispatch" },
      { phrase: "Hey Orion, open vendors", commandId: "dashboard.open", deepLink: "/vendors" },
      { phrase: "Orion, open team", commandId: "dashboard.open", deepLink: "/team" },
      { phrase: "Okay Orion, open memory review", commandId: "dashboard.open", deepLink: "/settings/memory-review" },
      { phrase: "Hey Orion, open mission control", commandId: "dashboard.open", deepLink: "/labs/mission-control" },
    ];

    for (const item of checks) {
      let fromCalls = 0;
      const supabase = {
        from() {
          fromCalls += 1;
          throw new Error("entity query should not run for deterministic navigation fast path");
        },
      } as unknown as SupabaseClient<Database>;

      const result = await resolveOrionIntent({
        supabase,
        workspace: buildWorkspace(),
        input: buildInput(item.phrase),
      });

      assert(result.suggestedCommand?.commandId === item.commandId, `${item.phrase} maps to ${item.commandId}`);
      const resolvedHref = item.commandId === "navigation.back"
        ? result.suggestedCommand?.params.fallbackHref
        : item.commandId === "schedule.read_range"
          ? null
          : result.suggestedCommand?.params.deepLink;
      assert(resolvedHref === item.deepLink, `${item.phrase} maps to deterministic deep link`);
      assert(result.confidence >= 0.95, `${item.phrase} keeps deterministic confidence`);
      assert(!result.requiresClarification, `${item.phrase} does not require clarification`);
      assert(fromCalls === 0, `${item.phrase} bypasses entity lookup`);
      if (item.commandId === "schedule.read_range") {
        assert(result.suggestedCommand?.params.rangeType === "day", `${item.phrase} resolves a day range`);
        assert(result.suggestedCommand?.params.rangeKey === "today", `${item.phrase} resolves the today key`);
      }
    }
  });

  console.log(`\nPhase 7C intent service fast-path results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
