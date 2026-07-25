"use client";

import { useState } from "react";

type OnboardingForm = {
  companyName: string;
  businessEmail: string;
  businessPhone: string;
  companyAddress: string;
  website: string;
};

export default function OnboardingPage() {
  const [form, setForm] = useState<OnboardingForm>({
    companyName: "",
    businessEmail: "",
    businessPhone: "",
    companyAddress: "",
    website: "",
  });

  const [error, setError] = useState("");

  function updateField(field: keyof OnboardingForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.companyName.trim() || !form.businessEmail.trim()) {
      setError("Company name and business email are required.");
      return;
    }

    setError("");
    alert("Step 1 complete. We will connect this to Supabase next.");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-slate-950 px-8 py-10 text-white sm:px-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">
              BangoOS onboarding
            </p>

            <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
              Welcome to BangoOS
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              Let&apos;s set up your construction company so your dashboard,
              customers, projects, and team are personalized from day one.
            </p>
          </div>

          <div className="px-8 py-8 sm:px-12 sm:py-10">
            <div className="mb-10">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-slate-900">Step 1 of 4</span>
                <span className="text-slate-500">Company information</span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/4 rounded-full bg-blue-600" />
              </div>
            </div>

            <form onSubmit={handleContinue} className="space-y-6">
              <div>
                <label
                  htmlFor="companyName"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Company Name
                </label>

                <input
                  id="companyName"
                  type="text"
                  value={form.companyName}
                  onChange={(event) =>
                    updateField("companyName", event.target.value)
                  }
                  placeholder="Bango Construction"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="businessEmail"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Business Email
                </label>

                <input
                  id="businessEmail"
                  type="email"
                  value={form.businessEmail}
                  onChange={(event) =>
                    updateField("businessEmail", event.target.value)
                  }
                  placeholder="office@yourcompany.com"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="businessPhone"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Business Phone
                </label>

                <input
                  id="businessPhone"
                  type="tel"
                  value={form.businessPhone}
                  onChange={(event) =>
                    updateField("businessPhone", event.target.value)
                  }
                  placeholder="(614) 555-1234"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="companyAddress"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Company Address
                </label>

                <input
                  id="companyAddress"
                  type="text"
                  value={form.companyAddress}
                  onChange={(event) =>
                    updateField("companyAddress", event.target.value)
                  }
                  placeholder="123 Main Street, Columbus, Ohio"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="website"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Website
                </label>

                <input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(event) =>
                    updateField("website", event.target.value)
                  }
                  placeholder="https://yourcompany.com"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
              >
                Continue
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}