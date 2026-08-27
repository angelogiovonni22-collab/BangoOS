import { NextRequest, NextResponse } from "next/server";
import { canAccessPath, normalizeCompanyRole } from "@/lib/access-control/permissions";
import { getOrionNavigationRoutesForRole } from "@/lib/orion/navigation";
import type { OrionCommandPermission } from "@/lib/orion/commands";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type SearchResult = {
  id: string;
  type: "workspace" | "customer" | "project" | "estimate" | "invoice" | "employee" | "crew" | "vendor";
  label: string;
  description: string;
  href: string;
  searchText: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function orionRole(value: string | null): OrionCommandPermission {
  const normalized = normalizeCompanyRole(value);
  if (normalized === "owner" || normalized === "administrator") return normalized;
  if (["operations_manager", "project_manager", "superintendent", "accountant", "employee"].includes(normalized)) {
    return normalized as OrionCommandPermission;
  }
  return "employee";
}

function score(result: SearchResult, query: string) {
  const label = normalize(result.label);
  const text = normalize(result.searchText);
  if (label === query) return 120;
  if (label.startsWith(query)) return 100;
  if (label.includes(query)) return 80;
  if (text.includes(query)) return 60;
  const words = query.split(" ").filter(Boolean);
  return words.reduce((total, word) => total + (text.includes(word) ? 10 : 0), 0);
}

function searchPattern(query: string) {
  return `%${query.split(" ").filter(Boolean).join("%")}%`;
}

export async function GET(req: NextRequest) {
  try {
    const query = normalize(new URL(req.url).searchParams.get("q") || "");
    if (query.length < 2) return NextResponse.json({ ok: true, results: [] });

    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "BOS workspace is unavailable." }, { status: 503 });
    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({ ok: false, error: workspace.errorMessage || "BOS workspace is unavailable." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const companyId = workspace.context.companyId;
    const companyRole = normalizeCompanyRole(workspace.context.role);
    const pattern = searchPattern(query);
    const [customers, projects, estimates, invoices, employees, crews, vendors] = await Promise.all([
      supabase.from("customers").select("id, company_name, first_name, last_name, email, phone, city, state, status").eq("company_id", companyId).or(`company_name.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern}`).limit(20),
      supabase.from("projects").select("id, name, project_number, job_site_name, address_line_1, city, state, postal_code, status").eq("company_id", companyId).or(`name.ilike.${pattern},project_number.ilike.${pattern},job_site_name.ilike.${pattern},address_line_1.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern},postal_code.ilike.${pattern}`).limit(20),
      supabase.from("estimates").select("id, title, estimate_number, status").eq("company_id", companyId).or(`title.ilike.${pattern},estimate_number.ilike.${pattern},status.ilike.${pattern}`).limit(20),
      supabase.from("invoices").select("id, title, invoice_number, status").eq("company_id", companyId).or(`title.ilike.${pattern},invoice_number.ilike.${pattern},status.ilike.${pattern}`).limit(20),
      supabase.from("employees").select("id, employee_number, position_title, trade, employment_status").eq("company_id", companyId).or(`employee_number.ilike.${pattern},position_title.ilike.${pattern},trade.ilike.${pattern},employment_status.ilike.${pattern}`).limit(20),
      supabase.from("crews").select("id, name, crew_code, status").eq("company_id", companyId).or(`name.ilike.${pattern},crew_code.ilike.${pattern},status.ilike.${pattern}`).limit(20),
      supabase.from("vendors").select("id, display_name, company_name, vendor_code, email, phone, city, state, status").eq("company_id", companyId).or(`display_name.ilike.${pattern},company_name.ilike.${pattern},vendor_code.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern}`).limit(20),
    ]);

    const failed = [customers, projects, estimates, invoices, employees, crews, vendors].find((result) => result.error);
    if (failed?.error) throw new Error(failed.error.message);

    const results: SearchResult[] = getOrionNavigationRoutesForRole(orionRole(workspace.context.role))
      .filter((route) => canAccessPath(companyRole, route.href))
      .map((route) => ({
        id: route.id,
        type: "workspace",
        label: route.label,
        description: route.subtitle,
        href: route.href,
        searchText: [route.label, route.subtitle, ...route.keywords].join(" "),
      }));

    if (canAccessPath(companyRole, "/customers")) for (const row of customers.data || []) {
      const person = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      const label = row.company_name?.trim() || person || "Customer";
      results.push({ id: row.id, type: "customer", label, description: `Customer · ${row.status}`, href: `/customers/${row.id}`, searchText: [label, person, row.email, row.phone, row.city, row.state].filter(Boolean).join(" ") });
    }
    if (canAccessPath(companyRole, "/projects")) for (const row of projects.data || []) {
      results.push({ id: row.id, type: "project", label: row.name, description: `Project · ${row.status}`, href: `/projects/${row.id}`, searchText: [row.name, row.project_number, row.job_site_name, row.address_line_1, row.city, row.state, row.postal_code].filter(Boolean).join(" ") });
    }
    if (canAccessPath(companyRole, "/estimates")) for (const row of estimates.data || []) {
      results.push({ id: row.id, type: "estimate", label: row.estimate_number ? `${row.estimate_number} · ${row.title}` : row.title, description: `Estimate · ${row.status}`, href: `/estimates/${row.id}`, searchText: [row.estimate_number, row.title, row.status].filter(Boolean).join(" ") });
    }
    if (canAccessPath(companyRole, "/invoices")) for (const row of invoices.data || []) {
      results.push({ id: row.id, type: "invoice", label: row.invoice_number ? `${row.invoice_number} · ${row.title}` : row.title, description: `Invoice · ${row.status}`, href: `/invoices/${row.id}`, searchText: [row.invoice_number, row.title, row.status].filter(Boolean).join(" ") });
    }
    if (canAccessPath(companyRole, "/employees")) for (const row of employees.data || []) {
      results.push({ id: row.id, type: "employee", label: `${row.employee_number} · ${row.position_title}`, description: `Employee · ${row.employment_status}`, href: `/employees/${row.id}`, searchText: [row.employee_number, row.position_title, row.trade, row.employment_status].filter(Boolean).join(" ") });
    }
    if (canAccessPath(companyRole, "/crews")) for (const row of crews.data || []) {
      results.push({ id: row.id, type: "crew", label: `${row.crew_code} · ${row.name}`, description: `Crew · ${row.status}`, href: `/crews/${row.id}`, searchText: [row.crew_code, row.name, row.status].join(" ") });
    }
    if (canAccessPath(companyRole, "/vendors")) for (const row of vendors.data || []) {
      results.push({ id: row.id, type: "vendor", label: row.display_name || row.company_name, description: `Vendor · ${row.status}`, href: `/vendors/${row.id}`, searchText: [row.display_name, row.company_name, row.vendor_code, row.email, row.phone, row.city, row.state].filter(Boolean).join(" ") });
    }

    const ranked = results
      .map((result) => ({ result, score: score(result, query) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.result.label.localeCompare(right.result.label))
      .slice(0, 12)
      .map((entry) => entry.result);

    return NextResponse.json({ ok: true, results: ranked });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Search is unavailable." }, { status: 500 });
  }
}
