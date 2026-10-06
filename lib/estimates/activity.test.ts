import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { loadEstimateActivity, estimateActivityLabel, type EstimateActivity } from "./activity";

type Fixture = EstimateActivity & { company_id: string; reference_entity: string; reference_id: string };
const rows: Fixture[] = Array.from({ length: 51 }, (_, index) => ({ id: String(index).padStart(3, "0"), company_id: "company-a", reference_entity: "estimate", reference_id: "estimate-a", event_type: "estimate.updated", occurred_at: new Date(Date.UTC(2026, 9, 6, 1, index)).toISOString(), current_state: null, next_state: null, payload: {} }));
rows.push(...["company", "entity", "record"].map((boundary) => ({ ...rows[50], id: boundary, company_id: boundary === "company" ? "company-b" : "company-a", reference_entity: boundary === "entity" ? "invoice" : "estimate", reference_id: boundary === "record" ? "estimate-b" : "estimate-a" })));
const db = { from(table: string) {
  assert.equal(table, "workflow_events");
  let selected = [...rows];
  const orders: Array<{ column: "occurred_at" | "id"; ascending: boolean }> = [];
  const builder = {
    select() { return builder; },
    eq(column: keyof Fixture, value: string) { selected = selected.filter((row) => row[column] === value); return builder; },
    order(column: "occurred_at" | "id", options: { ascending: boolean }) { orders.push({ column, ...options }); return builder; },
    limit(count: number) { selected.sort((a,b) => { for (const order of orders) { const diff = (order.ascending ? 1 : -1) * a[order.column].localeCompare(b[order.column]); if (diff) return diff; } return 0; }); return Promise.resolve({ data: selected.slice(0,count), error: null }); },
  };
  return builder;
} } as unknown as SupabaseClient<Database>;
async function run() {
const result = await loadEstimateActivity(db, "company-a", "estimate-a");
assert.equal(result.data?.length, 50);
assert.equal(result.data?.[0].id, "050");
assert.equal(result.data?.at(-1)?.id, "001");
assert.ok(result.data?.every((row) => /^\d+$/.test(row.id)), "exclude foreign company, entity and estimate records");
assert.equal(estimateActivityLabel({ ...rows[0], event_type: "estimate.expired", payload: { archived_at: "2026-10-06T01:00:00Z" } }), "Estimate archived");
assert.equal(estimateActivityLabel({ ...rows[0], event_type: "estimate.expired", payload: {} }), "Estimate Expired");
console.log("Estimate activity tenant/entity/record boundaries, latest-50 ordering, and archive evidence passed.");

}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
