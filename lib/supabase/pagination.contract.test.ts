import assert from "node:assert/strict";
import test from "node:test";
import { readAllSupabaseRowsForIds } from "./pagination";

test("parent filters are bounded and deduplicated while each batch's child history is paginated", async () => {
  const ids = Array.from({ length: 205 }, (_, index) => String(index));
  const calls: { ids: string[]; from: number }[] = [];
  const result = await readAllSupabaseRowsForIds([...ids, ids[0]], async (batch, from, to) => {
    calls.push({ ids: batch, from });
    const rows = batch.flatMap((id) => Array.from({ length: 6 }, (_, index) => ({ id: `${id}:${index}` })));
    return { data: rows.slice(from, to + 1), error: null };
  });
  assert.equal(result.data?.length, 1230);
  assert.equal(new Set(result.data?.map((row) => row.id)).size, 1230);
  assert.deepEqual(calls.map((call) => [call.ids.length, call.from]), [[100, 0], [100, 500], [100, 0], [100, 500], [5, 0]]);
});

test("failure in a later parent batch rejects all accumulated child history", async () => {
  const error = { message: "Later batch failed", code: "XX000" };
  const result = await readAllSupabaseRowsForIds(Array.from({ length: 101 }, (_, index) => String(index)), async (ids) => ids[0] === "100"
    ? { data: null, error }
    : { data: ids.map((id) => ({ id })), error: null });
  assert.deepEqual(result, { data: null, error });
});

test("no parent IDs returns an empty result without any unscoped request", async () => {
  const result = await readAllSupabaseRowsForIds([], async () => { throw new Error("Unexpected request"); });
  assert.deepEqual(result, { data: [], error: null });
});
