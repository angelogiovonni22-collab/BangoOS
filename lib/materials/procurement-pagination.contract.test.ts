import assert from "node:assert/strict";
import test from "node:test";
import { readAllProcurementRows } from "./procurement-pagination";

test("purchasing history includes rows beyond previous order, line and receipt limits", async () => {
  const rows = Array.from({ length: 1501 }, (_, id) => ({ id }));
  const ranges: number[][] = [];
  const result = await readAllProcurementRows(async (from, to) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  });
  assert.deepEqual(result.data, rows);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499], [1500, 1999]]);
});

test("a later-page error fails closed instead of returning partial purchasing totals", async () => {
  const error = { message: "History could not be loaded" };
  const result = await readAllProcurementRows(async (from) => from === 0
    ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
    : { data: null, error });
  assert.deepEqual(result, { data: null, error });
});

test("exact full pages finish only after an empty page; empty companies return no rows", async () => {
  const rows = Array.from({ length: 1000 }, (_, id) => id);
  let calls = 0;
  assert.deepEqual((await readAllProcurementRows(async (from, to) => {
    calls += 1;
    return { data: rows.slice(from, to + 1), error: null };
  })).data, rows);
  assert.equal(calls, 3);
  assert.deepEqual(await readAllProcurementRows(async () => ({ data: [], error: null })), { data: [], error: null });
});
