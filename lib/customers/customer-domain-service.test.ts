import assert from "node:assert/strict";
import { archiveCustomer, CustomerDomainError, restoreCustomer, updateCustomer } from "./customer-domain-service";

type MockOperation = {
  action: "select" | "update";
  selectClause?: string;
  updateValues?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

type MockResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type MockChain = {
  select(selectClause: string): MockChain;
  update(updateValues: Record<string, unknown>): MockChain;
  eq(column: string, value: unknown): MockChain;
  maybeSingle(): Promise<MockResult>;
  then(resolve: (value: { error: { message: string } | null }) => unknown, reject: (reason?: unknown) => unknown): Promise<unknown>;
};

type MockSupabase = {
  from: () => MockChain;
};

function createMockSupabase(params: {
  currentCustomer: Record<string, unknown> | null;
  selectError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const operations: MockOperation[] = [];

  const createChain = () => {
    let currentOperation: MockOperation | null = null;

    const chain: MockChain = {
      select(selectClause: string) {
        currentOperation = {
          action: "select",
          selectClause,
          filters: [],
        };
        operations.push(currentOperation);
        return chain;
      },
      update(updateValues: Record<string, unknown>) {
        currentOperation = {
          action: "update",
          updateValues,
          filters: [],
        };
        operations.push(currentOperation);
        return chain;
      },
      eq(column: string, value: unknown) {
        if (!currentOperation) {
          throw new Error("eq called before select or update");
        }

        currentOperation.filters.push([column, value]);
        return chain;
      },
      maybeSingle() {
        return Promise.resolve({
          data: params.currentCustomer,
          error: params.selectError ?? null,
        });
      },
      then(resolve: (value: { error: { message: string } | null }) => unknown, reject: (reason?: unknown) => unknown) {
        return Promise.resolve({ error: params.updateError ?? null }).then(resolve, reject);
      },
    };

    return chain;
  };

  return {
    supabase: {
      from: () => createChain(),
    } as MockSupabase,
    operations,
  };
}

function createEventPublisher() {
  const events: Array<Record<string, unknown>> = [];

  return {
    publisher: {
      publishEvent: async (event: Record<string, unknown>) => {
        events.push(event);
        return "event-id";
      },
    },
    events,
  };
}

const validInput = {
  customerType: "commercial" as const,
  firstName: "Ada",
  lastName: "Stone",
  email: "ada@example.com",
  phone: "5125550100",
  addressLine1: "123 Main St",
  addressLine2: "Suite 1",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  companyName: "Stone Builders",
  notes: "Prefers email",
};

const customerRow = {
  id: "customer-1",
  company_id: "company-a",
  customer_type: "commercial",
  first_name: "Ada",
  last_name: "Stone",
  company_name: "Stone Builders",
  email: "ada@example.com",
  phone: "5125550100",
  address_line_1: "123 Main St",
  address_line_2: "Suite 1",
  city: "Austin",
  state: "TX",
  postal_code: "78701",
  notes: "Prefers email",
  status: "active",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  created_by: "profile-1",
};

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  + ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  x ${name}`);
    console.error(error);
    failed += 1;
  }
}

async function main() {
  await test("updateCustomer validates input before touching Supabase", async () => {
    const { supabase, operations } = createMockSupabase({ currentCustomer: customerRow });
    const { publisher, events } = createEventPublisher();

    await assert.rejects(
      updateCustomer({
        supabase: supabase as unknown as Parameters<typeof updateCustomer>[0]["supabase"],
        companyId: "company-a",
        actorProfileId: "profile-1",
        role: "owner",
        customerId: "customer-1",
        input: {
          ...validInput,
          firstName: "",
        },
        eventPublisher: publisher,
      }),
      (error: unknown) => error instanceof CustomerDomainError && error.code === "VALIDATION",
    );

    assert.equal(operations.length, 0);
    assert.equal(events.length, 0);
  });

  await test("updateCustomer performs one company-scoped write and one event publish", async () => {
    const { supabase, operations } = createMockSupabase({ currentCustomer: customerRow });
    const { publisher, events } = createEventPublisher();

    const result = await updateCustomer({
      supabase: supabase as unknown as Parameters<typeof updateCustomer>[0]["supabase"],
      companyId: "company-a",
      actorProfileId: "profile-1",
      role: "project_manager",
      customerId: "customer-1",
      input: validInput,
      correlationId: "corr-1",
      idempotencyKey: "idem-1",
      eventPublisher: publisher,
    });

    assert.equal(result.customerId, "customer-1");
    assert.equal(result.deepLink, "/customers/customer-1");
    assert.equal(result.status, "active");
    assert.equal(operations.length, 2);
    assert.deepEqual(operations[0].filters, [["company_id", "company-a"], ["id", "customer-1"]]);
    assert.deepEqual(operations[1].filters, [["company_id", "company-a"], ["id", "customer-1"]]);
    assert.equal(events.length, 1);
    assert.equal(events[0].event_type, "customer.updated");
    assert.equal(events[0].idempotency_key, "idem-1:customer-updated");
  });

  await test("archiveCustomer and restoreCustomer share the same domain contract", async () => {
    const { supabase: archiveSupabase, operations: archiveOperations } = createMockSupabase({ currentCustomer: customerRow });
    const archivePublisher = createEventPublisher();

    const archived = await archiveCustomer({
      supabase: archiveSupabase as unknown as Parameters<typeof archiveCustomer>[0]["supabase"],
      companyId: "company-a",
      actorProfileId: "profile-1",
      role: "administrator",
      customerId: "customer-1",
      correlationId: "corr-2",
      idempotencyKey: "idem-2",
      eventPublisher: archivePublisher.publisher,
    });

    assert.equal(archived.status, "archived");
    assert.equal(archiveOperations.length, 2);
    assert.equal(archivePublisher.events.length, 1);
    assert.equal(archivePublisher.events[0].event_type, "customer.archived");
    assert.equal(archivePublisher.events[0].idempotency_key, "idem-2:customer.archived");

    const { supabase: restoreSupabase, operations: restoreOperations } = createMockSupabase({ currentCustomer: { ...customerRow, status: "archived" } });
    const restorePublisher = createEventPublisher();

    const restored = await restoreCustomer({
      supabase: restoreSupabase as unknown as Parameters<typeof restoreCustomer>[0]["supabase"],
      companyId: "company-a",
      actorProfileId: "profile-1",
      role: "owner",
      customerId: "customer-1",
      correlationId: "corr-3",
      idempotencyKey: "idem-3",
      eventPublisher: restorePublisher.publisher,
    });

    assert.equal(restored.status, "active");
    assert.equal(restoreOperations.length, 2);
    assert.equal(restorePublisher.events.length, 1);
    assert.equal(restorePublisher.events[0].event_type, "customer.restored");
    assert.equal(restorePublisher.events[0].idempotency_key, "idem-3:customer.restored");
  });

  await test("archiveCustomer and updateCustomer reject unauthorized roles", async () => {
    const { supabase } = createMockSupabase({ currentCustomer: customerRow });
    const { publisher, events } = createEventPublisher();

    await assert.rejects(
      archiveCustomer({
        supabase: supabase as unknown as Parameters<typeof archiveCustomer>[0]["supabase"],
        companyId: "company-a",
        actorProfileId: "profile-1",
        role: "employee",
        customerId: "customer-1",
        eventPublisher: publisher,
      }),
      (error: unknown) => error instanceof CustomerDomainError && error.code === "PERMISSION",
    );

    await assert.rejects(
      updateCustomer({
        supabase: supabase as unknown as Parameters<typeof updateCustomer>[0]["supabase"],
        companyId: "company-a",
        actorProfileId: "profile-1",
        role: "employee",
        customerId: "customer-1",
        input: validInput,
        eventPublisher: publisher,
      }),
      (error: unknown) => error instanceof CustomerDomainError && error.code === "PERMISSION",
    );

    assert.equal(events.length, 0);
  });

  console.log(`\nCustomer domain service results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
