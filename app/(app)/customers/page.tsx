"use client";

import { useMemo, useState } from "react";

type Customer = {
  id: string;
  name: string;
  type: "Residential" | "Commercial";
  email: string;
  phone: string;
  location: string;
  status: "Lead" | "Active" | "Inactive";
};

const sampleCustomers: Customer[] = [];

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filteredCustomers = useMemo(() => {
    return sampleCustomers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || customer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Customer Management</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Customers
          </h1>

          <p className="mt-2 text-slate-600">
            Manage customer contact information, projects, estimates, and
            invoices.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <span className="mr-2 text-lg leading-none">+</span>
          Add Customer
        </button>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Customers" value="0" />
        <SummaryCard title="Active Customers" value="0" />
        <SummaryCard title="Leads" value="0" />
        <SummaryCard title="Commercial Accounts" value="0" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Customer Directory
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Search and manage all customer records.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block">
                <span className="sr-only">Search customers</span>

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customers..."
                  className="w-full min-w-64 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label>
                <span className="sr-only">Filter by status</span>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="All">All statuses</option>
                  <option value="Lead">Leads</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>Customer</TableHeading>
                  <TableHeading>Type</TableHeading>
                  <TableHeading>Contact</TableHeading>
                  <TableHeading>Location</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading align="right">Actions</TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-semibold text-slate-950">
                        {customer.name}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        Customer ID: {customer.id}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {customer.type}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-slate-700">
                        {customer.email}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        {customer.phone}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {customer.location}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={customer.status} />
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        className="text-sm font-semibold text-blue-600 transition hover:text-blue-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
                C
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                No customers yet
              </h3>

              <p className="mt-2 leading-7 text-slate-500">
                Add your first residential or commercial customer to begin
                tracking projects, estimates, invoices, and communication.
              </p>

              <button
                type="button"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <span className="mr-2 text-lg leading-none">+</span>
                Add Your First Customer
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({
  status,
}: {
  status: Customer["status"];
}) {
  const styles = {
    Lead: "bg-amber-50 text-amber-700 ring-amber-600/20",
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {status}
    </span>
  );
}