"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CustomerType = "residential" | "commercial";

type CustomerFormData = {
	customerType: CustomerType;
	companyName: string;
	firstName: string;
	lastName: string;
	email: string;
	phoneNumber: string;
	streetAddress: string;
	city: string;
	state: string;
	zipCode: string;
	notes: string;
};

const initialFormData: CustomerFormData = {
	customerType: "residential",
	companyName: "",
	firstName: "",
	lastName: "",
	email: "",
	phoneNumber: "",
	streetAddress: "",
	city: "",
	state: "",
	zipCode: "",
	notes: "",
};

export default function NewCustomerPage() {
	const router = useRouter();
	const supabase = createClient();

	const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
	const [isSaving, setIsSaving] = useState(false);

	const handleFieldChange = <K extends keyof CustomerFormData>(
		field: K,
		value: CustomerFormData[K],
	) => {
		setFormData((previous) => ({
			...previous,
			[field]: value,
		}));
	};

	const handleCancel = () => {
		setFormData(initialFormData);
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!formData.customerType) {
			window.alert("Please select a customer type.");
			return;
		}

		if (!formData.firstName.trim()) {
			window.alert("First name is required.");
			return;
		}

		if (!formData.lastName.trim()) {
			window.alert("Last name is required.");
			return;
		}

		if (!formData.email.trim()) {
			window.alert("Email is required.");
			return;
		}

		if (!supabase) {
			window.alert("Unable to connect right now. Please try again shortly.");
			return;
		}

		setIsSaving(true);

		try {
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();

			if (userError || !user) {
				window.alert("You need to be logged in to save a customer.");
				return;
			}

			const { data: company, error: companyError } = await supabase
				.from("companies")
				.select("id")
				.eq("owner_id", user.id)
				.maybeSingle();

			if (companyError) {
				window.alert(`Unable to find your company: ${companyError.message}`);
				return;
			}

			if (!company) {
				window.alert("No company was found for your account.");
				return;
			}

			const { error: insertError } = await supabase.from("customers").insert({
				company_id: company.id,
				customer_type: formData.customerType,
				first_name: formData.firstName.trim(),
				last_name: formData.lastName.trim(),
				company_name: formData.companyName.trim() || null,
				email: formData.email.trim(),
				phone: formData.phoneNumber.trim() || null,
				address_line_1: formData.streetAddress.trim() || null,
				address_line_2: null,
				city: formData.city.trim() || null,
				state: formData.state.trim() || null,
				postal_code: formData.zipCode.trim() || null,
				notes: formData.notes.trim() || null,
				created_by: user.id,
			});

			if (insertError) {
				window.alert(`Unable to save customer: ${insertError.message}`);
				return;
			}

			router.push("/customers");
			router.refresh();
		} catch (caughtError) {
			console.error("Save customer error:", caughtError);
			window.alert("Something unexpected happened while saving. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-8">
			<section>
				<p className="text-sm font-medium text-slate-500">Customer Management</p>

				<h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
					Add Customer
				</h1>

				<p className="mt-2 text-slate-600">
					Create a new residential or commercial customer.
				</p>
			</section>

			<form onSubmit={handleSubmit} className="space-y-6">
				<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-950">
						Customer Information
					</h2>

					<div className="mt-5 grid gap-5 md:grid-cols-2">
						<Field>
							<Label htmlFor="customerType">Customer Type</Label>
							<select
								id="customerType"
								value={formData.customerType}
								onChange={(event) =>
									handleFieldChange(
										"customerType",
										event.target.value as CustomerType,
									)
								}
								className={inputClassName}
								required
							>
								<option value="residential">Residential</option>
								<option value="commercial">Commercial</option>
							</select>
						</Field>

						<Field>
							<Label htmlFor="companyName">Company Name (optional)</Label>
							<input
								id="companyName"
								type="text"
								value={formData.companyName}
								onChange={(event) =>
									handleFieldChange("companyName", event.target.value)
								}
								placeholder="Bango Construction LLC"
								className={inputClassName}
							/>
						</Field>

						<Field>
							<Label htmlFor="firstName">First Name</Label>
							<input
								id="firstName"
								type="text"
								value={formData.firstName}
								onChange={(event) =>
									handleFieldChange("firstName", event.target.value)
								}
								placeholder="Jordan"
								className={inputClassName}
								required
							/>
						</Field>

						<Field>
							<Label htmlFor="lastName">Last Name</Label>
							<input
								id="lastName"
								type="text"
								value={formData.lastName}
								onChange={(event) =>
									handleFieldChange("lastName", event.target.value)
								}
								placeholder="Smith"
								className={inputClassName}
								required
							/>
						</Field>
					</div>
				</section>

				<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-950">
						Contact Information
					</h2>

					<div className="mt-5 grid gap-5 md:grid-cols-2">
						<Field>
							<Label htmlFor="email">Email</Label>
							<input
								id="email"
								type="email"
								value={formData.email}
								onChange={(event) => handleFieldChange("email", event.target.value)}
								placeholder="customer@example.com"
								className={inputClassName}
								required
							/>
						</Field>

						<Field>
							<Label htmlFor="phoneNumber">Phone Number</Label>
							<input
								id="phoneNumber"
								type="tel"
								value={formData.phoneNumber}
								onChange={(event) =>
									handleFieldChange("phoneNumber", event.target.value)
								}
								placeholder="(555) 123-4567"
								className={inputClassName}
								required
							/>
						</Field>
					</div>
				</section>

				<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-950">Address</h2>

					<div className="mt-5 grid gap-5 md:grid-cols-2">
						<Field className="md:col-span-2">
							<Label htmlFor="streetAddress">Street Address</Label>
							<input
								id="streetAddress"
								type="text"
								value={formData.streetAddress}
								onChange={(event) =>
									handleFieldChange("streetAddress", event.target.value)
								}
								placeholder="123 Main St"
								className={inputClassName}
								required
							/>
						</Field>

						<Field>
							<Label htmlFor="city">City</Label>
							<input
								id="city"
								type="text"
								value={formData.city}
								onChange={(event) => handleFieldChange("city", event.target.value)}
								placeholder="Austin"
								className={inputClassName}
								required
							/>
						</Field>

						<Field>
							<Label htmlFor="state">State</Label>
							<input
								id="state"
								type="text"
								value={formData.state}
								onChange={(event) => handleFieldChange("state", event.target.value)}
								placeholder="TX"
								className={inputClassName}
								required
							/>
						</Field>

						<Field>
							<Label htmlFor="zipCode">ZIP Code</Label>
							<input
								id="zipCode"
								type="text"
								value={formData.zipCode}
								onChange={(event) =>
									handleFieldChange("zipCode", event.target.value)
								}
								placeholder="78701"
								className={inputClassName}
								required
							/>
						</Field>
					</div>
				</section>

				<section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
					<h2 className="text-lg font-semibold text-slate-950">
						Additional Information
					</h2>

					<Field className="mt-5">
						<Label htmlFor="notes">Notes</Label>
						<textarea
							id="notes"
							value={formData.notes}
							onChange={(event) => handleFieldChange("notes", event.target.value)}
							placeholder="Add any customer-specific details, preferences, or project notes..."
							rows={5}
							className={inputClassName}
						/>
					</Field>
				</section>

				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<button
						type="button"
						onClick={handleCancel}
						className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					>
						Cancel
					</button>

					<button
						type="submit"
						disabled={isSaving}
						className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
					>
						{isSaving ? "Saving..." : "Save Customer"}
					</button>
				</div>
			</form>
		</div>
	);
}

const inputClassName =
	"w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function Field({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <div className={className}>{children}</div>;
}

function Label({
	children,
	htmlFor,
}: {
	children: React.ReactNode;
	htmlFor: string;
}) {
	return (
		<label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700">
			{children}
		</label>
	);
}
