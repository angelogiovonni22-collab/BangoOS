import assert from "node:assert/strict";
import test from "node:test";
import { canManageInvoices } from "../invoices/service";
import { COMPANY_ROLES, hasBosPermission } from "./permissions";

test("invoice mutation defaults match the canonical database roles and retain explicit overrides", () => {
  for (const role of COMPANY_ROLES) {
    assert.equal(hasBosPermission(role, "invoices.manage"), ["owner", "administrator", "office_manager", "accountant"].includes(role), role);
  }
  assert.equal(hasBosPermission("project_manager", "invoices.view"), true);
  assert.equal(hasBosPermission("project_manager", "invoices.manage", { "invoices.manage": true }), true);
  assert.equal(hasBosPermission("office_manager", "invoices.manage", { "invoices.manage": false }), false);
});

test("invoice screens require an affirmative company-scoped database permission result", async () => {
  for (const data of [true, false, null, "true", 1]) {
    const client = { rpc(name: string, args: unknown) {
      assert.equal(name, "bos_role_has_permission");
      assert.deepEqual(args, { p_company_id: "company", p_permission: "invoices.manage" });
      return Promise.resolve({ data, error: null });
    } };
    assert.equal(await canManageInvoices(client as never, "company"), data === true);
  }
  assert.equal(await canManageInvoices({ rpc: () => Promise.resolve({ data: true, error: { message: "unavailable" } }) } as never, "company"), false);
  assert.equal(await canManageInvoices({ rpc: () => Promise.reject(new Error("network unavailable")) } as never, "company"), false);
});
