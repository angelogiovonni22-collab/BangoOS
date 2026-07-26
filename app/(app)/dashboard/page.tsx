import RecentProjectsWidget from "./recent-projects-widget";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-slate-500">Dashboard</p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Good evening, Angelo
        </h1>

        <p className="mt-2 text-slate-600">
          Here is a quick overview of your construction business.
        </p>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Projects"
          value="0"
          description="Projects currently in progress"
        />

        <MetricCard
          title="Open Estimates"
          value="0"
          description="Estimates waiting for approval"
        />

        <MetricCard
          title="Invoices Due"
          value="$0"
          description="Outstanding customer balances"
        />

        <MetricCard
          title="Customers"
          value="0"
          description="Total customer records"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Today&apos;s Schedule
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Meetings, jobsite visits, and project deadlines.
            </p>
          </div>

          <div className="mt-8 flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div>
              <p className="font-semibold text-slate-800">
                Nothing scheduled today
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Your upcoming appointments and project events will appear here.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Quick Actions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Start a common task.
            </p>
          </div>

          <div className="mt-6 grid gap-3">
            <ActionButton label="Add Customer" />
            <ActionButton label="Create Project" />
            <ActionButton label="Create Estimate" />
            <ActionButton label="Create Invoice" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Recent Activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              The latest activity across your workspace.
            </p>
          </div>

          <div className="mt-8 flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <div>
              <p className="font-semibold text-slate-800">
                No recent activity
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Customer, project, estimate, and invoice activity will appear
                here.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            AI Assistant
          </p>

          <h2 className="mt-4 text-2xl font-bold">
            Your workspace is ready
          </h2>

          <p className="mt-3 leading-7 text-slate-300">
            Add your first customer or project to begin tracking your business
            and generating useful insights.
          </p>

          <button
            type="button"
            className="mt-6 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Open AI Assistant
          </button>
        </div>
      </section>

      <RecentProjectsWidget />
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-500">{description}</p>
    </article>
  );
}

function ActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      {label}
    </button>
  );
}