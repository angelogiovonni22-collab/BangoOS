import { buildDecisionCandidate, defineDecisionRule } from "./decision-rule";
import type { OrionDecisionRule } from "./decision-types";

function diffDays(fromIso: string, to: Date) {
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) {
    return 0;
  }

  return Math.floor((to.getTime() - from) / (24 * 60 * 60 * 1000));
}

function daysUntil(fromIso: string, from: Date) {
  const target = new Date(fromIso).getTime();
  if (!Number.isFinite(target)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((target - from.getTime()) / (24 * 60 * 60 * 1000));
}

function isStatus(value: string, statuses: string[]) {
  const normalized = value.trim().toLowerCase();
  return statuses.includes(normalized);
}

function customerLabel(customer: { first_name: string | null; last_name: string | null; company_name: string | null }) {
  const person = [customer.first_name?.trim() || "", customer.last_name?.trim() || ""].filter(Boolean).join(" ");
  return person || customer.company_name?.trim() || "Customer";
}

function estimateLabel(estimate: { estimate_number: string | null; id: string }) {
  return estimate.estimate_number || estimate.id.slice(0, 8).toUpperCase();
}

export function createDecisionRegistry(): OrionDecisionRule[] {
  return [
    defineDecisionRule({
      id: "estimate-pending-too-long",
      enabled: true,
      category: "estimates",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        return estimates
          .filter((estimate) => isStatus(estimate.status, ["sent", "viewed", "ready"]))
          .filter((estimate) => diffDays(estimate.created_at, now) >= 10)
          .map((estimate) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "estimate-pending-too-long",
            priority: "high",
            category: "estimates",
            title: "Estimate pending too long",
            summary: `Estimate ${estimateLabel(estimate)} has been pending for more than 10 days.`,
            recommendation: "Follow up with customer and confirm decision timeline.",
            entityType: "estimate",
            entityId: estimate.id,
            href: `/estimates/${estimate.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Estimate",
          }));
      },
    }),
    defineDecisionRule({
      id: "estimate-viewed-not-approved",
      enabled: true,
      category: "estimates",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        return estimates
          .filter((estimate) => isStatus(estimate.status, ["viewed"]))
          .map((estimate) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "estimate-viewed-not-approved",
            priority: "medium",
            category: "estimates",
            title: "Estimate viewed but not approved",
            summary: `Estimate ${estimateLabel(estimate)} was viewed and is still awaiting approval.`,
            recommendation: "Send a follow-up reminder and offer clarification call.",
            entityType: "estimate",
            entityId: estimate.id,
            href: `/estimates/${estimate.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Estimate",
          }));
      },
    }),
    defineDecisionRule({
      id: "estimate-expiring-soon",
      enabled: true,
      category: "estimates",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        return estimates
          .filter((estimate) => Boolean(estimate.expiration_date))
          .filter((estimate) => {
            const expiresAt = new Date(estimate.expiration_date || "");
            if (Number.isNaN(expiresAt.getTime())) {
              return false;
            }
            const days = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            return days >= 0 && days <= 3 && isStatus(estimate.status, ["sent", "viewed", "ready"]);
          })
          .map((estimate) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "estimate-expiring-soon",
            priority: "high",
            category: "estimates",
            title: "Estimate expires soon",
            summary: `Estimate ${estimateLabel(estimate)} expires within 3 days.`,
            recommendation: "Contact the customer and confirm approval or revision before expiry.",
            entityType: "estimate",
            entityId: estimate.id,
            href: `/estimates/${estimate.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Estimate",
          }));
      },
    }),
    defineDecisionRule({
      id: "high-value-estimate-not-viewed",
      enabled: true,
      category: "estimates",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        return estimates
          .filter((estimate) => estimate.total_amount >= 50000)
          .filter((estimate) => isStatus(estimate.status, ["sent", "ready"]))
          .map((estimate) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "high-value-estimate-not-viewed",
            priority: "critical",
            category: "estimates",
            title: "High value estimate not viewed",
            summary: `High-value estimate ${estimateLabel(estimate)} has not been viewed yet.`,
            recommendation: "Escalate follow-up with customer decision maker.",
            entityType: "estimate",
            entityId: estimate.id,
            href: `/estimates/${estimate.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Estimate",
          }));
      },
    }),
    defineDecisionRule({
      id: "customer-inactive",
      enabled: true,
      category: "customers",
      async evaluate(context) {
        const now = context.now();
        const customers = await context.load.customers();
        return customers
          .filter((customer) => diffDays(customer.updated_at, now) >= 60)
          .map((customer) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "customer-inactive",
            priority: "medium",
            category: "customers",
            title: "Customer inactive",
            summary: `${customerLabel(customer)} has no recent updates in over 60 days.`,
            recommendation: "Review relationship status and schedule outreach.",
            entityType: "customer",
            entityId: customer.id,
            href: `/customers/${customer.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Customer",
          }));
      },
    }),
    defineDecisionRule({
      id: "customer-no-followup",
      enabled: true,
      category: "customers",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        return estimates
          .filter((estimate) => estimate.customer_id !== null)
          .filter((estimate) => isStatus(estimate.status, ["sent", "viewed"]))
          .filter((estimate) => !estimate.followup_due_at)
          .map((estimate) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "customer-no-followup",
            priority: "high",
            category: "customers",
            title: "No follow-up scheduled",
            summary: `Estimate ${estimateLabel(estimate)} has no follow-up date.`,
            recommendation: "Schedule follow-up date with customer owner.",
            entityType: "customer",
            entityId: estimate.customer_id,
            href: `/customers/${estimate.customer_id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Customer",
          }));
      },
    }),
    defineDecisionRule({
      id: "customer-outstanding-signature",
      enabled: true,
      category: "customers",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        return estimates
          .filter((estimate) => isStatus(estimate.status, ["approved"]))
          .filter((estimate) => !estimate.agreement_version_id)
          .map((estimate) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "customer-outstanding-signature",
            priority: "high",
            category: "customers",
            title: "Outstanding signature",
            summary: `Approved estimate ${estimateLabel(estimate)} is missing an agreement signature package.`,
            recommendation: "Send agreement packet and request customer signature.",
            entityType: "estimate",
            entityId: estimate.id,
            href: `/estimates/${estimate.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Estimate",
          }));
      },
    }),
    defineDecisionRule({
      id: "customer-outstanding-deposit",
      enabled: true,
      category: "customers",
      async evaluate(context) {
        const now = context.now();
        const estimates = await context.load.estimates();
        const invoices = await context.load.invoices();
        const invoiceByEstimate = new Map(invoices.filter((invoice) => invoice.estimate_id).map((invoice) => [invoice.estimate_id as string, invoice]));

        return estimates
          .filter((estimate) => isStatus(estimate.status, ["approved"]))
          .map((estimate) => ({ estimate, invoice: invoiceByEstimate.get(estimate.id) || null }))
          .filter(({ estimate, invoice }) => Boolean(estimate.deposit_invoice_id || invoice?.id))
          .filter(({ invoice }) => {
            const target = invoice;
            if (!target) {
              return true;
            }
            return Math.max(0, target.total_amount - target.amount_paid) > 0;
          })
          .map(({ estimate, invoice }) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "customer-outstanding-deposit",
            priority: "high",
            category: "customers",
            title: "Outstanding deposit",
            summary: `Customer deposit for estimate ${estimateLabel(estimate)} is still outstanding.`,
            recommendation: "Follow up on deposit invoice payment.",
            entityType: "invoice",
            entityId: invoice?.id || estimate.deposit_invoice_id || null,
            href: invoice?.id ? `/invoices/${invoice.id}` : `/estimates/${estimate.id}`,
            detectedAt: now.toISOString(),
            actionLabel: invoice?.id ? "Open Invoice" : "Open Estimate",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-delayed",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        const tasks = await context.load.tasks();
        const byProject = new Map<string, typeof tasks>();
        for (const task of tasks) {
          const existing = byProject.get(task.project_id) || [];
          existing.push(task);
          byProject.set(task.project_id, existing);
        }

        return projects
          .filter((project) => isStatus(project.status, ["scheduled", "in_progress", "approved"]))
          .filter((project) => (byProject.get(project.id) || []).some((task) => isStatus(task.status, ["blocked"])))
          .map((project) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "project-delayed",
            priority: "high",
            category: "projects",
            title: "Project delayed",
            summary: `Project ${project.name} has blocked work delaying progress.`,
            recommendation: "Review blocked tasks and remove dependencies.",
            entityType: "project",
            entityId: project.id,
            href: `/projects/${project.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Project",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-overdue",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        return projects
          .filter((project) => Boolean(project.estimated_end_date))
          .filter((project) => new Date(project.estimated_end_date || "").getTime() < now.getTime())
          .filter((project) => !isStatus(project.status, ["completed", "closed"]))
          .map((project) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "project-overdue",
            priority: "critical",
            category: "projects",
            title: "Project overdue",
            summary: `Project ${project.name} is past its estimated end date.`,
            recommendation: "Escalate recovery plan and reset completion forecast.",
            entityType: "project",
            entityId: project.id,
            href: `/projects/${project.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Project",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-missing-schedule",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        const tasks = await context.load.tasks();
        const scheduledProjectIds = new Set(tasks.filter((task) => task.planned_start || task.planned_finish).map((task) => task.project_id));
        return projects
          .filter((project) => isStatus(project.status, ["approved", "scheduled", "in_progress"]))
          .filter((project) => !scheduledProjectIds.has(project.id))
          .map((project) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "project-missing-schedule",
            priority: "high",
            category: "projects",
            title: "Missing schedule",
            summary: `Project ${project.name} has no scheduled tasks.`,
            recommendation: "Create schedule milestones and assign target dates.",
            entityType: "schedule",
            entityId: project.id,
            href: `/schedule`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Schedule",
            actionHref: "/schedule",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-no-daily-reports",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        const reportEvents = await context.load.workflowEvents(["daily_report.created"], 500);
        const recentReportByProject = new Set(
          reportEvents
            .filter((event) => diffDays(event.occurred_at, now) <= 3)
            .map((event) => event.reference_id),
        );

        return projects
          .filter((project) => isStatus(project.status, ["in_progress"]))
          .filter((project) => !recentReportByProject.has(project.id))
          .map((project) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "project-no-daily-reports",
            priority: "medium",
            category: "projects",
            title: "No daily reports",
            summary: `Project ${project.name} has no daily report in the last 3 days.`,
            recommendation: "Request site supervisor report submission.",
            entityType: "project",
            entityId: project.id,
            href: `/projects/${project.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Project",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-no-assigned-crew",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        const tasks = await context.load.tasks();

        return projects
          .filter((project) => isStatus(project.status, ["scheduled", "in_progress"]))
          .filter((project) => (tasks.filter((task) => task.project_id === project.id)).every((task) => !task.assigned_profile_id))
          .map((project) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "project-no-assigned-crew",
            priority: "high",
            category: "projects",
            title: "No assigned crew",
            summary: `Project ${project.name} has no assigned crew members.`,
            recommendation: "Assign crew to active project tasks.",
            entityType: "project",
            entityId: project.id,
            href: `/projects/${project.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Project",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-missing-permits",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        const permits = await context.load.permits();
        const requiredStatuses = new Set(["required", "preparing", "submitted", "under_review", "renewal_required"]);

        const openPermitCountByProject = new Map<string, number>();
        for (const permit of permits) {
          if (!requiredStatuses.has(permit.status.trim().toLowerCase())) {
            continue;
          }

          openPermitCountByProject.set(permit.project_id, (openPermitCountByProject.get(permit.project_id) || 0) + 1);
        }

        return projects
          .filter((project) => isStatus(project.status, ["approved", "scheduled", "in_progress"]))
          .filter((project) => (openPermitCountByProject.get(project.id) || 0) > 0)
          .map((project) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "project-missing-permits",
            priority: "high",
            category: "projects",
            title: "Required permit still open",
            summary: `Project ${project.name} has permit items that are not yet issued or closed.`,
            recommendation: "Submit and advance required permits before field execution is blocked.",
            entityType: "project",
            entityId: project.id,
            href: `/projects/${project.id}/permits`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Permits",
          }));
      },
    }),
    defineDecisionRule({
      id: "permit-under-review-too-long",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const permits = await context.load.permits();

        return permits
          .filter((permit) => isStatus(permit.status, ["submitted", "under_review"]))
          .filter((permit) => permit.submitted_at && diffDays(permit.submitted_at, now) >= 7)
          .map((permit) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "permit-under-review-too-long",
            priority: "high",
            category: "projects",
            title: "Permit under review too long",
            summary: `Permit ${permit.permit_type} has been waiting more than 7 days for authority response.`,
            recommendation: "Follow up with the jurisdiction and capture response notes.",
            entityType: "project",
            entityId: permit.project_id,
            href: `/projects/${permit.project_id}/permits?permitId=${permit.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Permit",
          }));
      },
    }),
    defineDecisionRule({
      id: "permit-expiring-soon",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const permits = await context.load.permits();

        return permits
          .filter((permit) => isStatus(permit.status, ["issued", "renewal_required"]))
          .filter((permit) => Boolean(permit.expiration_date))
          .filter((permit) => {
            const days = daysUntil(permit.expiration_date as string, now);
            return days >= 0 && days <= 14;
          })
          .map((permit) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "permit-expiring-soon",
            priority: "high",
            category: "projects",
            title: "Permit expires soon",
            summary: `Permit ${permit.permit_type} expires within 14 days.`,
            recommendation: "Prepare renewal paperwork before expiration.",
            entityType: "project",
            entityId: permit.project_id,
            href: `/projects/${permit.project_id}/permits?permitId=${permit.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Permit",
          }));
      },
    }),
    defineDecisionRule({
      id: "permit-expired-or-rejected",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const permits = await context.load.permits();

        return permits
          .filter((permit) => isStatus(permit.status, ["expired", "rejected"]))
          .map((permit) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "permit-expired-or-rejected",
            priority: "critical",
            category: "projects",
            title: "Permit expired or rejected",
            summary: isStatus(permit.status, ["expired"])
              ? `Permit ${permit.permit_type} has expired and may block work.`
              : `Permit ${permit.permit_type} was rejected${permit.rejection_reason ? `: ${permit.rejection_reason}` : "."}`,
            recommendation: "Escalate permit correction and resubmission immediately.",
            entityType: "project",
            entityId: permit.project_id,
            href: `/projects/${permit.project_id}/permits?permitId=${permit.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Permit",
          }));
      },
    }),
    defineDecisionRule({
      id: "project-closeout-blocked",
      enabled: true,
      category: "projects",
      async evaluate(context) {
        const now = context.now();
        const projects = await context.load.projects();
        const closeouts = await context.load.closeouts();
        const punchItems = await context.load.punchItems();

        const projectById = new Map(projects.map((project) => [project.id, project]));
        const openPunchCountByProject = new Map<string, number>();
        for (const item of punchItems) {
          if (!isStatus(item.status, ["open", "in_progress", "reopened"])) {
            continue;
          }
          openPunchCountByProject.set(item.project_id, (openPunchCountByProject.get(item.project_id) || 0) + 1);
        }

        return closeouts
          .filter((closeout) => isStatus(closeout.status, ["in_progress", "blocked"]))
          .filter((closeout) => {
            const blockers = [
              !closeout.required_documents_completed,
              !closeout.permit_closure_completed,
              !closeout.final_payment_recorded,
              !closeout.customer_approval_recorded,
              !closeout.crew_removal_completed,
              !closeout.equipment_return_completed,
              !isStatus(closeout.handover_status, ["completed"]),
              (openPunchCountByProject.get(closeout.project_id) || 0) > 0,
            ];
            return blockers.some(Boolean);
          })
          .map((closeout) => {
            const project = projectById.get(closeout.project_id);
            return buildDecisionCandidate({
              companyId: context.companyId,
              ruleId: "project-closeout-blocked",
              priority: "high",
              category: "projects",
              title: "Project closeout blocked",
              summary: `Project ${project?.name || closeout.project_id} has unresolved closeout blockers.`,
              recommendation: "Resolve closeout checklist items before marking project complete.",
              entityType: "project",
              entityId: closeout.project_id,
              href: `/projects/${closeout.project_id}/closeout?closeoutId=${closeout.id}`,
              detectedAt: now.toISOString(),
              actionLabel: "Open Closeout",
            });
          });
      },
    }),
    defineDecisionRule({
      id: "deposit-overdue",
      enabled: true,
      category: "finance",
      async evaluate(context) {
        const now = context.now();
        const invoices = await context.load.invoices();

        return invoices
          .filter((invoice) => invoice.estimate_id !== null)
          .filter((invoice) => Boolean(invoice.due_date))
          .filter((invoice) => Math.max(0, invoice.total_amount - invoice.amount_paid) > 0)
          .filter((invoice) => new Date(invoice.due_date || "").getTime() < now.getTime())
          .map((invoice) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "deposit-overdue",
            priority: "critical",
            category: "finance",
            title: "Deposit overdue",
            summary: `Deposit invoice ${invoice.id.slice(0, 8).toUpperCase()} is overdue.`,
            recommendation: "Follow up with customer and secure deposit payment.",
            entityType: "invoice",
            entityId: invoice.id,
            href: `/invoices/${invoice.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Invoice",
          }));
      },
    }),
    defineDecisionRule({
      id: "invoice-overdue",
      enabled: true,
      category: "finance",
      async evaluate(context) {
        const now = context.now();
        const invoices = await context.load.invoices();

        return invoices
          .filter((invoice) => Boolean(invoice.due_date))
          .filter((invoice) => Math.max(0, invoice.total_amount - invoice.amount_paid) > 0)
          .filter((invoice) => new Date(invoice.due_date || "").getTime() < now.getTime())
          .map((invoice) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "invoice-overdue",
            priority: "high",
            category: "finance",
            title: "Invoice overdue",
            summary: `Invoice ${invoice.id.slice(0, 8).toUpperCase()} is overdue with unpaid balance.`,
            recommendation: "Escalate collections follow-up and adjust cash projection.",
            entityType: "invoice",
            entityId: invoice.id,
            href: `/invoices/${invoice.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Invoice",
          }));
      },
    }),
    defineDecisionRule({
      id: "invoice-unpaid",
      enabled: true,
      category: "finance",
      async evaluate(context) {
        const now = context.now();
        const invoices = await context.load.invoices();

        return invoices
          .filter((invoice) => isStatus(invoice.status, ["sent", "viewed", "overdue", "partially_paid", "partial"]))
          .filter((invoice) => Math.max(0, invoice.total_amount - invoice.amount_paid) > 0)
          .map((invoice) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "invoice-unpaid",
            priority: "medium",
            category: "finance",
            title: "Invoice unpaid",
            summary: `Invoice ${invoice.id.slice(0, 8).toUpperCase()} remains unpaid.`,
            recommendation: "Review payment status and customer communication.",
            entityType: "invoice",
            entityId: invoice.id,
            href: `/invoices/${invoice.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Invoice",
          }));
      },
    }),
    defineDecisionRule({
      id: "negative-projected-cash-flow",
      enabled: true,
      category: "finance",
      async evaluate(context) {
        const now = context.now();
        const invoices = await context.load.invoices();
        const totalOutstanding = invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.total_amount - invoice.amount_paid), 0);
        const totalOverdue = invoices
          .filter((invoice) => invoice.due_date && new Date(invoice.due_date).getTime() < now.getTime())
          .reduce((sum, invoice) => sum + Math.max(0, invoice.total_amount - invoice.amount_paid), 0);

        if (totalOutstanding <= 0) {
          return [];
        }

        const overdueRatio = totalOverdue / totalOutstanding;
        if (overdueRatio < 0.6) {
          return [];
        }

        return [buildDecisionCandidate({
          companyId: context.companyId,
          ruleId: "negative-projected-cash-flow",
          priority: "critical",
          category: "finance",
          title: "Negative projected cash flow",
          summary: "Overdue receivables exceed 60% of outstanding balances.",
          recommendation: "Freeze discretionary spend and prioritize collections.",
          entityType: "company",
          entityId: null,
          href: "/invoices",
          detectedAt: now.toISOString(),
          actionLabel: "Open Invoice",
          actionHref: "/invoices",
        })];
      },
    }),
    defineDecisionRule({
      id: "large-unpaid-balance",
      enabled: true,
      category: "finance",
      async evaluate(context) {
        const now = context.now();
        const invoices = await context.load.invoices();
        return invoices
          .filter((invoice) => Math.max(0, invoice.total_amount - invoice.amount_paid) >= 50000)
          .map((invoice) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "large-unpaid-balance",
            priority: "high",
            category: "finance",
            title: "Large unpaid balance",
            summary: `Invoice ${invoice.id.slice(0, 8).toUpperCase()} has a large unpaid balance.`,
            recommendation: "Assign executive follow-up for large receivable.",
            entityType: "invoice",
            entityId: invoice.id,
            href: `/invoices/${invoice.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Invoice",
          }));
      },
    }),
    defineDecisionRule({
      id: "crew-overloaded",
      enabled: true,
      category: "workforce",
      async evaluate(context) {
        const now = context.now();
        const crews = await context.load.crews();
        const memberships = await context.load.crewMemberships();
        const tasks = await context.load.tasks();

        return crews
          .map((crew) => {
            const memberCount = memberships.filter((member) => member.crew_id === crew.id && !isStatus(member.status, ["inactive", "archived"]))
              .length;
            const assignedTasks = tasks.filter((task) => !isStatus(task.status, ["completed"]))
              .filter((task) => memberships.some((member) => member.crew_id === crew.id && member.employee_id === task.assigned_profile_id)).length;
            return { crew, memberCount, assignedTasks };
          })
          .filter((entry) => entry.memberCount > 0)
          .filter((entry) => entry.assignedTasks >= entry.memberCount * 4)
          .map((entry) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "crew-overloaded",
            priority: "high",
            category: "workforce",
            title: "Crew overloaded",
            summary: `Crew ${entry.crew.name} workload exceeds staffing capacity.`,
            recommendation: "Rebalance assignments or add temporary support.",
            entityType: "crew",
            entityId: entry.crew.id,
            href: `/crews/${entry.crew.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Crew",
          }));
      },
    }),
    defineDecisionRule({
      id: "crew-idle",
      enabled: true,
      category: "workforce",
      async evaluate(context) {
        const now = context.now();
        const crews = await context.load.crews();
        const memberships = await context.load.crewMemberships();
        const tasks = await context.load.tasks();

        return crews
          .filter((crew) => isStatus(crew.status, ["active"]))
          .filter((crew) => memberships.some((member) => member.crew_id === crew.id))
          .filter((crew) => !tasks.some((task) => memberships.some((member) => member.crew_id === crew.id && member.employee_id === task.assigned_profile_id)))
          .map((crew) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "crew-idle",
            priority: "medium",
            category: "workforce",
            title: "Crew idle",
            summary: `Crew ${crew.name} has no assigned active work.`,
            recommendation: "Assign upcoming tasks or reallocate resources.",
            entityType: "crew",
            entityId: crew.id,
            href: `/crews/${crew.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Crew",
          }));
      },
    }),
    defineDecisionRule({
      id: "employee-without-assignment",
      enabled: true,
      category: "workforce",
      async evaluate(context) {
        const now = context.now();
        const employees = await context.load.employees();
        return employees
          .filter((employee) => isStatus(employee.employment_status, ["active"]))
          .filter((employee) => !employee.primary_crew_id)
          .map((employee) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "employee-without-assignment",
            priority: "medium",
            category: "workforce",
            title: "Employee without assignment",
            summary: `Employee ${employee.id.slice(0, 8).toUpperCase()} has no crew assignment.`,
            recommendation: "Assign employee to an active crew.",
            entityType: "employee",
            entityId: employee.id,
            href: `/employees/${employee.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Employee",
          }));
      },
    }),
    defineDecisionRule({
      id: "missing-supervisor",
      enabled: true,
      category: "workforce",
      async evaluate(context) {
        const now = context.now();
        const crews = await context.load.crews();
        return crews
          .filter((crew) => isStatus(crew.status, ["active"]))
          .filter((crew) => !crew.supervisor_profile_id)
          .map((crew) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "missing-supervisor",
            priority: "high",
            category: "workforce",
            title: "Missing supervisor",
            summary: `Crew ${crew.name} does not have a supervisor assigned.`,
            recommendation: "Assign a supervising profile to this crew.",
            entityType: "crew",
            entityId: crew.id,
            href: `/crews/${crew.id}`,
            detectedAt: now.toISOString(),
            actionLabel: "Open Crew",
          }));
      },
    }),
    defineDecisionRule({
      id: "expired-certifications-placeholder",
      enabled: true,
      category: "workforce",
      async evaluate(context) {
        const now = context.now();
        const employees = await context.load.employees();
        if (employees.length === 0) {
          return [];
        }

        return [buildDecisionCandidate({
          companyId: context.companyId,
          ruleId: "expired-certifications-placeholder",
          priority: "low",
          category: "workforce",
          title: "Expired certifications (placeholder)",
          summary: "Certification expiry tracking is not configured in this workspace.",
          recommendation: "Enable certification expiration data source for workforce compliance.",
          entityType: "employee",
          entityId: employees[0]?.id || null,
          href: employees[0]?.id ? `/employees/${employees[0].id}` : "/employees",
          detectedAt: now.toISOString(),
          actionLabel: "Open Employee",
          actionHref: employees[0]?.id ? `/employees/${employees[0].id}` : "/employees",
        })];
      },
    }),
    defineDecisionRule({
      id: "automation-failure-rate-high",
      enabled: true,
      category: "operations",
      async evaluate(context) {
        const now = context.now();
        const events = await context.load.workflowEvents(["automation.failed", "automation.rule.completed"], 400);
        const last24h = events.filter((event) => diffDays(event.occurred_at, now) <= 1);
        const failures = last24h.filter((event) => event.event_type === "automation.failed").length;
        const total = last24h.length;

        if (total < 5 || failures / total < 0.25) {
          return [];
        }

        return [buildDecisionCandidate({
          companyId: context.companyId,
          ruleId: "automation-failure-rate-high",
          priority: "critical",
          category: "operations",
          title: "High automation failure rate",
          summary: `Automation failure rate is ${Math.round((failures / total) * 100)}% in the last 24 hours.`,
          recommendation: "Review failed automation runs and remediate common errors.",
          entityType: "company",
          entityId: null,
          href: "/dashboard",
          detectedAt: now.toISOString(),
          actionLabel: "Open Schedule",
          actionHref: "/dashboard",
        })];
      },
    }),
    defineDecisionRule({
      id: "workflow-repeated-failures",
      enabled: true,
      category: "operations",
      async evaluate(context) {
        const now = context.now();
        const events = await context.load.workflowEvents(["automation.failed"], 400);
        const countByRule = new Map<string, number>();
        for (const event of events.filter((item) => diffDays(item.occurred_at, now) <= 3)) {
          const ruleId = String(event.payload.rule_id || "unknown-rule");
          countByRule.set(ruleId, (countByRule.get(ruleId) || 0) + 1);
        }

        return Array.from(countByRule.entries())
          .filter(([, count]) => count >= 3)
          .map(([ruleId, count]) => buildDecisionCandidate({
            companyId: context.companyId,
            ruleId: "workflow-repeated-failures",
            priority: "high",
            category: "operations",
            title: "Repeated workflow failures",
            summary: `Rule ${ruleId} failed ${count} times in the last 72 hours.`,
            recommendation: "Inspect workflow steps and resolve recurring failure causes.",
            entityType: "company",
            entityId: null,
            href: "/dashboard",
            detectedAt: now.toISOString(),
            actionLabel: "Open Schedule",
            actionHref: "/dashboard",
          }));
      },
    }),
    defineDecisionRule({
      id: "automation-backlog",
      enabled: true,
      category: "operations",
      async evaluate(context) {
        const now = context.now();
        const events = await context.load.workflowEvents([
          "automation.rule.started",
          "automation.rule.completed",
          "automation.failed",
        ], 600);

        const started = events.filter((item) => item.event_type === "automation.rule.started");
        const completed = new Set(
          events
            .filter((item) => item.event_type === "automation.rule.completed" || item.event_type === "automation.failed")
            .map((item) => String(item.payload.run_id || item.reference_id)),
        );

        const staleOpenRuns = started.filter((item) => {
          const runId = String(item.payload.run_id || item.reference_id);
          if (completed.has(runId)) {
            return false;
          }

          return diffDays(item.occurred_at, now) >= 1;
        });

        if (staleOpenRuns.length === 0) {
          return [];
        }

        return [buildDecisionCandidate({
          companyId: context.companyId,
          ruleId: "automation-backlog",
          priority: "high",
          category: "operations",
          title: "Automation backlog",
          summary: `${staleOpenRuns.length} automation runs are still open for more than 24 hours.`,
          recommendation: "Review automation queue and clear blocked runs.",
          entityType: "company",
          entityId: null,
          href: "/dashboard",
          detectedAt: now.toISOString(),
          actionLabel: "Open Schedule",
          actionHref: "/dashboard",
        })];
      },
    }),
  ];
}
