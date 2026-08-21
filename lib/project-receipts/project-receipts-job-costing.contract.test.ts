import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migration = readFileSync(join(root, "supabase/migrations/20260821011500_project_receipts_job_costing.sql"), "utf8");
const approvalGuard = readFileSync(join(root, "supabase/migrations/20260821012000_project_receipt_approval_guard.sql"), "utf8");
const route = readFileSync(join(root, "app/api/projects/[id]/receipts/route.ts"), "utf8");
const workspace = readFileSync(join(root, "components/projects/workspace/project-receipts-workspace.tsx"), "utf8");
const financials = readFileSync(join(root, "components/projects/workspace/project-financial-reporting.tsx"), "utf8");

assert.match(migration, /create table if not exists public\.project_receipts/i, "Receipt financial records must have a dedicated table.");
assert.match(migration, /create table if not exists public\.project_receipt_items/i, "Receipt line items must be stored separately for categorization.");
assert.match(migration, /file_sha256/i, "Receipt records must keep a content hash for exact duplicate prevention.");
assert.match(migration, /idx_project_receipts_company_file_sha256_unique/i, "Exact duplicate receipt files must be blocked per company.");
assert.match(migration, /status in \('processing','needs_review','approved','rejected','failed'\)/i, "Receipt posting must use an explicit review lifecycle.");
assert.match(migration, /finalize_project_receipt/i, "Receipt approval and item posting must be atomic.");
assert.match(migration, /project-receipts/i, "Receipts must use a private project-scoped storage bucket.");
assert.match(migration, /enable row level security/i, "Receipt tables must be protected with RLS.");
assert.match(approvalGuard, /enforce_project_receipt_approval_role/i, "Financial posting must have a database-level approval guard.");
assert.match(approvalGuard, /owner.*administrator.*operations_manager.*project_manager.*office_manager.*accountant/is, "Only managerial/accounting roles may approve receipt costs.");
assert.match(approvalGuard, /old\.status = 'approved'.*new\.status <> 'approved'/is, "Reversing an approved receipt must also be permission guarded.");

assert.match(route, /OPENAI_API_KEY/i, "Receipt image extraction must use the existing server-side OpenAI credential.");
assert.match(route, /image_url/i, "Receipt extraction must be vision based.");
assert.match(route, /sha256/i, "Upload ingestion must hash receipt bytes before posting.");
assert.match(route, /This exact receipt has already been uploaded/i, "Exact duplicate uploads must be rejected clearly.");
assert.match(route, /Possible|duplicate_of|duplicateOf/i, "Near-duplicate receipt candidates must require review.");
assert.match(route, /finalize_project_receipt/i, "Approved receipt posting must go through the atomic database function.");
assert.match(route, /buildProjectFinancialReport/i, "Receipt responses must return project financial context.");

assert.match(workspace, /Add Receipt/i, "Project financials must provide a direct receipt capture action.");
assert.match(workspace, /capture="environment"/i, "Mobile field users must be able to open the rear camera for receipt capture.");
assert.match(workspace, /Review Receipt Before Posting Cost/i, "AI extraction must be reviewed before it changes financials.");
assert.match(workspace, /Approve & Add to Job Cost/i, "The financial posting action must be explicit.");
assert.match(workspace, /Possible duplicate detected/i, "The UI must surface suspected duplicate receipts.");
assert.match(workspace, /Contract Value/i, "The receipt workspace must preserve and display contract value separately from costs.");
assert.match(workspace, /Remaining Contract Dollars/i, "The receipt workspace must show the live contract-minus-cost position.");

assert.match(financials, /approvedReceiptSpend/i, "Approved receipts must update project financial calculations in real time.");
assert.match(financials, /actualCost = toMoney\(report\.summary\.actualCost \+ approvedReceiptSpend\)/i, "Receipt spend must increase Actual Cost without modifying contract value.");
assert.match(financials, /revisedContractValue - forecastFinalCost/i, "Projected gross profit must react to receipt-driven costs.");
assert.match(financials, /row\.category !== "materials"/i, "Approved receipt spend must roll into the material job-cost category.");

console.log("Project receipts + real-time job costing contract passed.");
