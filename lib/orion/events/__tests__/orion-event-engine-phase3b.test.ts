import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createOrionEventPublisher,
  createOrionSubscriberRegistry,
  type OrionDeliveryClaim,
  type OrionEventDeliveryStore,
  type OrionEventInput,
  type OrionEventRecord,
  validateOrionEventInput,
} from "../index";

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

function baseInput(overrides: Partial<OrionEventInput> = {}): OrionEventInput {
  return {
    company_id: "company-a",
    actor_profile_id: "profile-a",
    event_type: "estimate.created",
    aggregate_type: "estimate",
    aggregate_id: "estimate-a",
    source_module: "estimates",
    payload: {
      estimate_number: "EST-1001",
      total_amount: 1200,
    },
    ...overrides,
  };
}

function inMemoryStore() {
  const records: OrionEventRecord[] = [];

  return {
    get records() {
      return records;
    },
    async ensureActorScope(companyId: string, actorProfileId: string | null) {
      if (actorProfileId && !actorProfileId.startsWith("profile-")) {
        throw new Error(`Actor ${actorProfileId} outside ${companyId}`);
      }
    },
    async findByIdempotency(companyId: string, eventType: string, idempotencyKey: string) {
      return records.find(
        (row) => row.company_id === companyId
          && row.event_type === eventType
          && row.idempotency_key === idempotencyKey,
      ) || null;
    },
    async append(input: OrionEventInput & { idempotency_key: string; event_id?: string }) {
      await this.ensureActorScope(input.company_id, input.actor_profile_id);

      const record: OrionEventRecord = {
        event_id: input.event_id || `${input.company_id}-${records.length + 1}`,
        company_id: input.company_id,
        workspace_id: input.workspace_id || null,
        actor_profile_id: input.actor_profile_id,
        event_type: input.event_type,
        aggregate_type: input.aggregate_type,
        aggregate_id: input.aggregate_id,
        occurred_at: input.occurred_at || new Date().toISOString(),
        version: input.version ?? 1,
        source_module: input.source_module,
        payload: input.payload,
        metadata: input.metadata || {},
        correlation_id: input.correlation_id || null,
        causation_id: input.causation_id || null,
        idempotency_key: input.idempotency_key,
      };

      records.push(record);
      return record;
    },
  };
}

function inMemoryDeliveryStore(): OrionEventDeliveryStore {
  const states = new Map<string, OrionDeliveryClaim | "failed">();

  function key(event: OrionEventRecord, subscriberKey: string) {
    return `${event.company_id}:${event.event_id}:${subscriberKey}`;
  }

  return {
    async claim(event, subscriberKey) {
      const deliveryKey = key(event, subscriberKey);
      const state = states.get(deliveryKey);
      if (state === "delivered") {
        return "delivered";
      }
      states.set(deliveryKey, "claimed");
      return "claimed";
    },
    async markDelivered(event, subscriberKey) {
      states.set(key(event, subscriberKey), "delivered");
    },
    async markFailed(event, subscriberKey) {
      states.set(key(event, subscriberKey), "failed");
    },
  };
}

async function main() {
  await test("1. event contracts enforce required validation", () => {
    const valid = validateOrionEventInput(baseInput());
    check(valid.ok, "valid event passes validation");

    const invalid = validateOrionEventInput(baseInput({ company_id: "", payload: [] as unknown as Record<string, unknown> }));
    check(!invalid.ok, "invalid event fails validation");
  });

  await test("2. publisher enforces idempotency per company + event type", async () => {
    const store = inMemoryStore();
    const publisher = createOrionEventPublisher({ store });

    const first = await publisher.publishEvent(baseInput({ idempotency_key: "same-key" }));
    const second = await publisher.publishEvent(baseInput({ idempotency_key: "same-key" }));
    const otherCompany = await publisher.publishEvent(baseInput({ company_id: "company-b", idempotency_key: "same-key" }));

    check(!first.idempotent, "first publish writes new event");
    check(second.idempotent, "second publish returns idempotent event");
    check(store.records.length === 2, "idempotency key is isolated by company scope");
    check(otherCompany.event.company_id === "company-b", "cross-company publish remains isolated");
  });

  await test("3. subscribers dispatch after persistence", async () => {
    const store = inMemoryStore();
    const subscribers = createOrionSubscriberRegistry();
    const publisher = createOrionEventPublisher({ store, subscribers });

    let dispatchCount = 0;

    subscribers.register("estimate.created", "test-estimate-created", () => {
      dispatchCount += 1;
    });

    await publisher.publishEvent(baseInput());

    check(store.records.length === 1, "event is persisted");
    check(dispatchCount === 1, "subscriber receives published event");
  });

  await test("4. publisher recovers when a concurrent retry wins the unique-key race", async () => {
    const store = inMemoryStore();
    const originalAppend = store.append.bind(store);
    let raced = false;
    store.append = async (input) => {
      if (!raced) {
        raced = true;
        await originalAppend(input);
        throw new Error("duplicate key value violates unique constraint");
      }
      return originalAppend(input);
    };
    const publisher = createOrionEventPublisher({ store });

    const result = await publisher.publishEvent(baseInput({ idempotency_key: "racing-key" }));

    check(result.idempotent, "concurrent duplicate is returned as an idempotent success");
    check(store.records.length === 1, "concurrent duplicate does not create another event");
  });

  await test("5. durable delivery replays only the subscriber that failed", async () => {
    const store = inMemoryStore();
    const deliveryStore = inMemoryDeliveryStore();
    const subscribers = createOrionSubscriberRegistry();
    const publisher = createOrionEventPublisher({ store, subscribers, deliveryStore });

    let stableCount = 0;
    let retryCount = 0;

    subscribers.register("estimate.created", "stable-subscriber", () => {
      stableCount += 1;
    });
    subscribers.register("estimate.created", "retry-subscriber", () => {
      retryCount += 1;
      if (retryCount === 1) {
        throw new Error("temporary subscriber failure");
      }
    });

    let firstFailed = false;
    try {
      await publisher.publishEvent(baseInput({ idempotency_key: "delivery-replay-key" }));
    } catch {
      firstFailed = true;
    }

    const retry = await publisher.publishEvent(baseInput({ idempotency_key: "delivery-replay-key" }));

    check(firstFailed, "initial subscriber failure is surfaced to the caller");
    check(retry.idempotent, "retry reuses the already-persisted event");
    check(store.records.length === 1, "delivery retry does not duplicate the event ledger row");
    check(stableCount === 1, "already delivered subscriber is not replayed");
    check(retryCount === 2, "failed subscriber is replayed exactly once on retry");
  });

  await test("6. source integrations call Orion publisher in key mutation paths", () => {
    const files = [
      resolve(process.cwd(), "app", "(app)", "customers", "new", "page.tsx"),
      resolve(process.cwd(), "app", "(app)", "projects", "new", "page.tsx"),
      resolve(process.cwd(), "lib", "estimates", "service.ts"),
      resolve(process.cwd(), "lib", "invoices", "service.ts"),
      resolve(process.cwd(), "lib", "workforce", "workforce-event-repository.ts"),
      resolve(process.cwd(), "lib", "workflows", "workflow-engine.ts"),
    ];

    const combined = files.map((filePath) => readFileSync(filePath, "utf8")).join("\n");

    check(combined.includes("createSupabaseOrionEventPublisher"), "Orion publisher is wired into mutation modules");
    check(combined.includes("customer.created"), "customer.created event publish exists");
    check(combined.includes("project.created"), "project.created event publish exists");
    check(combined.includes("estimate.created"), "estimate.created event publish exists");
    check(combined.includes("invoice.created"), "invoice.created event publish exists");
    check(combined.includes("invoice.paid"), "invoice.paid event publish exists");
    check(combined.includes("source_module: \"workflows\""), "workflow bridge enriches workflow event rows");
  });

  await test("7. migrations cover the Orion event ledger and durable delivery replay", () => {
    const foundationPath = resolve(process.cwd(), "supabase", "migrations", "20260803150000_orion_event_engine_foundation.sql");
    const foundation = readFileSync(foundationPath, "utf8").toLowerCase();
    const deliveryPath = resolve(process.cwd(), "supabase", "migrations", "20261010122500_orion_event_delivery_replay.sql");
    const delivery = readFileSync(deliveryPath, "utf8").toLowerCase();

    check(foundation.includes("alter table public.workflow_events"), "migration extends existing workflow_events table");
    check(foundation.includes("add column if not exists source_module text"), "source_module column is present");
    check(foundation.includes("add column if not exists payload jsonb"), "payload column is present");
    check(foundation.includes("add column if not exists idempotency_key text"), "idempotency_key column is present");
    check(foundation.includes("idx_workflow_events_company_event_idempotency"), "idempotency index is present");
    check(!foundation.includes("create table public.orion"), "foundation does not introduce a second Orion event table");
    check(delivery.includes("create table if not exists public.orion_event_deliveries"), "delivery ledger is durable in Postgres");
    check(delivery.includes("claim_orion_event_delivery"), "delivery claim RPC is present");
    check(delivery.includes("lease_expires_at"), "delivery claims have an expiry lease for crash recovery");
    check(delivery.includes("revoke all on table public.orion_event_deliveries from public, anon, authenticated"), "delivery ledger is not directly writable by browser roles");
  });

  console.log(`\nOrion event engine phase 3B results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
