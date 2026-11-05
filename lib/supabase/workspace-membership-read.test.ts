import assert from "node:assert/strict";
import { resolveWorkspaceContext } from "./workspace";

function createHarness(membershipError: { message: string; code?: string } | null, role = "employee") {
  const writes: string[] = [], reads: string[] = [];
  const companyId = "synthetic-company", userId = "synthetic-user";
  const profile = { id: userId, company_id: companyId, role };
  const membership = { id: "synthetic-membership", company_id: companyId, role, status: "active", is_primary: true };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from(table: string) {
      reads.push(table);
      let write = false;
      const result = () => {
        if (write) return { data: null, error: null };
        if (table === "profiles") return { data: profile, error: null };
        if (table === "company_memberships") return { data: membershipError ? null : [membership], error: membershipError };
        if (table === "companies") return { data: { id: companyId, name: "Synthetic company" }, error: null };
        throw new Error("Unexpected table: " + table);
      };
      const chain = {
        select() { return chain; }, eq() { return chain; }, order() { return chain; },
        update() { write = true; writes.push(table); return chain; },
        upsert() { write = true; writes.push(table); return chain; },
        maybeSingle() { return Promise.resolve(result()); },
        then(resolve: (value: ReturnType<typeof result>) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return chain;
    },
  };
  return { client, reads, writes };
}

for (const role of ["owner", "employee", "foreman"]) {
  const harness = createHarness(null, role);
  const result = await resolveWorkspaceContext(harness.client as never);
  assert.equal(result.context?.role, role, "active membership keeps its verified role");
  assert.equal(result.context?.membershipId, "synthetic-membership");
  assert.deepEqual(harness.writes, [], "verified membership lookup does not repair or change access");
}

for (const error of [{ message: "Synthetic network interruption" }, { message: "Synthetic policy rejection", code: "42501" }, { message: "Synthetic schema unavailable", code: "PGRST205" }]) {
  const harness = createHarness(error, "owner");
  const result = await resolveWorkspaceContext(harness.client as never);
  assert.equal(result.context, null, "failed membership read cannot fall back to a profile role");
  assert.equal(result.errorCode, "company_unavailable");
  assert.match(result.errorMessage || "", /verify your company access/);
  assert.deepEqual(harness.writes, [], "read failure must not repair profiles or memberships");
  assert.equal(harness.reads.includes("companies"), false, "stop before loading a tenant after failed access verification");
}

console.log("Workspace membership verification: 24 assertions passed.");
