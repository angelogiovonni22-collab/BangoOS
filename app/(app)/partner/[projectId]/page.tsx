import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type TradePartnerJob = {
  assignment_id: string;
  project_id: string;
  project_name: string;
  project_status: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  trade_name: string;
  scope_of_work: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  assignment_status: string;
  contract_status: string;
};

type PartnerPhoto = {
  id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  category: string;
  note: string | null;
  captured_at: string | null;
  created_at: string;
  is_mine: boolean;
};

type PartnerPlan = {
  version_id: string;
  sheet_number: string;
  title: string;
  discipline: string;
  revision_label: string;
  version_number: number;
  original_filename: string;
  mime_type: string;
  storage_path: string;
  issued_at: string | null;
};

type PartnerMessage = {
  id: string;
  body: string;
  sender_type: "internal" | "trade_partner";
  created_at: string;
  is_mine: boolean;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type PartnerRpcClient = {
  rpc: {
    (name: "get_my_trade_partner_jobs"): RpcResult<TradePartnerJob[]>;
    (name: "get_my_trade_partner_photos", args: { p_project_id: string }): RpcResult<PartnerPhoto[]>;
    (name: "get_my_trade_partner_plans", args: { p_project_id: string }): RpcResult<PartnerPlan[]>;
    (name: "get_my_trade_partner_messages", args: { p_project_id: string }): RpcResult<PartnerMessage[]>;
    (name: "send_my_trade_partner_message", args: { p_project_id: string; p_body: string }): RpcResult<string>;
    (name: "register_my_trade_partner_photo", args: {
      p_project_id: string;
      p_storage_path: string;
      p_original_filename: string;
      p_mime_type: string;
      p_file_size: number;
      p_category: string;
      p_note: string | null;
    }): RpcResult<string>;
  };
};

type PageProps = { params: Promise<{ projectId: string }>; searchParams: Promise<{ notice?: string; error?: string }> };

export default async function TradePartnerProjectPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/login");
  if ((workspace.context.role || "").toLowerCase() !== "subcontractor") redirect("/app-entry");

  const rpc = (supabase as unknown as PartnerRpcClient).rpc;
  const jobsResult = await rpc("get_my_trade_partner_jobs");
  const job = (jobsResult.data ?? []).find((item) => item.project_id === projectId);
  if (!job) redirect("/partner");

  const [photoResult, planResult, messageResult] = await Promise.all([
    rpc("get_my_trade_partner_photos", { p_project_id: projectId }),
    rpc("get_my_trade_partner_plans", { p_project_id: projectId }),
    rpc("get_my_trade_partner_messages", { p_project_id: projectId }),
  ]);

  const photos = await Promise.all((photoResult.data ?? []).map(async (photo) => ({
    ...photo,
    url: (await supabase.storage.from("project-photos").createSignedUrl(photo.storage_path, 3600)).data?.signedUrl ?? null,
  })));
  const plans = await Promise.all((planResult.data ?? []).map(async (plan) => ({
    ...plan,
    url: (await supabase.storage.from("blueprints").createSignedUrl(plan.storage_path, 3600)).data?.signedUrl ?? null,
  })));
  const messages = messageResult.data ?? [];

  async function sendMessage(formData: FormData) {
    "use server";
    const client = await createClient();
    if (!client) redirect("/login");
    const context = await resolveWorkspaceContext(client);
    if (!context.context || (context.context.role || "").toLowerCase() !== "subcontractor") redirect("/app-entry");
    const body = String(formData.get("body") || "").trim();
    if (!body) redirect(`/partner/${projectId}?error=${encodeURIComponent("Enter a message first.")}`);
    const result = await (client as unknown as PartnerRpcClient).rpc("send_my_trade_partner_message", { p_project_id: projectId, p_body: body });
    if (result.error) redirect(`/partner/${projectId}?error=${encodeURIComponent(result.error.message)}`);
    revalidatePath(`/partner/${projectId}`);
    redirect(`/partner/${projectId}?notice=${encodeURIComponent("Message sent.")}`);
  }

  async function uploadPhoto(formData: FormData) {
    "use server";
    const client = await createClient();
    if (!client) redirect("/login");
    const context = await resolveWorkspaceContext(client);
    if (!context.context || (context.context.role || "").toLowerCase() !== "subcontractor") redirect("/app-entry");

    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) redirect(`/partner/${projectId}?error=${encodeURIComponent("Choose a photo first.")}`);
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
    if (!allowedTypes.has(file.type)) redirect(`/partner/${projectId}?error=${encodeURIComponent("Use a JPG, PNG, WebP, or HEIC photo.")}`);
    if (file.size > 10 * 1024 * 1024) redirect(`/partner/${projectId}?error=${encodeURIComponent("Photo must be 10 MB or smaller.")}`);

    const category = String(formData.get("category") || "progress");
    const note = String(formData.get("note") || "").trim();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "photo";
    const storagePath = `${context.context.companyId}/${projectId}/${crypto.randomUUID()}-${cleanName}`;
    const upload = await client.storage.from("project-photos").upload(storagePath, file, { contentType: file.type, upsert: false });
    if (upload.error) redirect(`/partner/${projectId}?error=${encodeURIComponent(upload.error.message)}`);

    const registration = await (client as unknown as PartnerRpcClient).rpc("register_my_trade_partner_photo", {
      p_project_id: projectId,
      p_storage_path: storagePath,
      p_original_filename: file.name,
      p_mime_type: file.type,
      p_file_size: file.size,
      p_category: category,
      p_note: note || null,
    });
    if (registration.error) {
      await client.storage.from("project-photos").remove([storagePath]);
      redirect(`/partner/${projectId}?error=${encodeURIComponent(registration.error.message)}`);
    }
    revalidatePath(`/partner/${projectId}`);
    redirect(`/partner/${projectId}?notice=${encodeURIComponent("Photo uploaded.")}`);
  }

  return (
    <div className="container-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/partner" className="text-sm font-semibold text-[#8ec3ff] hover:underline">← All assigned jobs</Link>
        <span className="rounded-full border border-[var(--bos-border-default)] px-3 py-1 text-xs font-semibold text-[var(--bos-text-secondary)]">{formatLabel(job.project_status)}</span>
      </div>

      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ec3ff]">{job.trade_name}</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--bos-text-primary)]">{job.project_name}</h1>
        <p className="mt-2 text-sm text-[var(--bos-text-secondary)]">{formatAddress(job)}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Info label="Start" value={formatDate(job.start_date)} />
          <Info label="Target completion" value={formatDate(job.target_completion_date)} />
          <Info label="Agreement" value={formatLabel(job.contract_status)} />
        </div>
        <div className="mt-5 rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">Assigned Scope</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--bos-text-primary)]">{job.scope_of_work || "Scope has not been published yet."}</p>
        </div>
      </section>

      {query.notice ? <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{query.notice}</div> : null}
      {query.error ? <div className="rounded-xl border border-rose-300/40 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{query.error}</div> : null}
      {photoResult.error || planResult.error || messageResult.error ? <div className="rounded-xl border border-amber-300/40 bg-amber-50 p-3 text-sm text-amber-900">Some project channels could not be loaded. Ask your B.O.S. administrator to confirm the latest database migration is applied.</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <section id="photos" className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Field Channel</p><h2 className="mt-1 text-xl font-semibold">Photos</h2></div><span className="text-xs text-[var(--bos-text-muted)]">{photos.length} shared</span></div>
            <form action={uploadPhoto} encType="multipart/form-data" className="mt-4 grid gap-3 rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)] sm:col-span-2">Add jobsite photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic" required className="mt-2 block w-full text-sm font-medium normal-case tracking-normal text-[var(--bos-text-primary)]" /></label>
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">Category<select name="category" className="mt-2 h-10 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-sm normal-case tracking-normal text-[var(--bos-text-primary)]"><option value="progress">Progress</option><option value="materials">Materials</option><option value="inspection">Inspection</option><option value="safety">Safety</option><option value="damage">Damage</option><option value="other">Other</option></select></label>
              <label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">Note<input name="note" maxLength={500} placeholder="What does this show?" className="mt-2 h-10 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-sm normal-case tracking-normal text-[var(--bos-text-primary)]" /></label>
              <button type="submit" className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 sm:col-span-2">Upload Photo</button>
            </form>
            {photos.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo) => <article key={photo.id} className="overflow-hidden rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)]">{photo.url ? <a href={photo.url} target="_blank" rel="noreferrer" className="block"><img src={photo.url} alt={photo.note || photo.original_filename || "Jobsite photo"} className="h-40 w-full object-cover" /></a> : <div className="flex h-40 items-center justify-center text-xs text-[var(--bos-text-muted)]">Preview unavailable</div>}<div className="p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase text-[#8ec3ff]">{formatLabel(photo.category)}</span>{photo.is_mine ? <span className="text-[10px] text-[var(--bos-text-muted)]">Uploaded by you</span> : null}</div><p className="mt-2 text-sm text-[var(--bos-text-secondary)]">{photo.note || photo.original_filename || "Jobsite photo"}</p><p className="mt-2 text-[11px] text-[var(--bos-text-muted)]">{formatDateTime(photo.captured_at || photo.created_at)}</p></div></article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-5 text-sm text-[var(--bos-text-secondary)]">No field photos have been shared on this assignment yet.</p>}
          </section>

          <section id="plans" className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Approved Documents</p><h2 className="mt-1 text-xl font-semibold">Plans</h2></div><span className="text-xs text-[var(--bos-text-muted)]">Latest approved revisions only</span></div>
            {plans.length ? <div className="mt-4 space-y-3">{plans.map((plan) => <article key={plan.version_id} className="flex flex-col gap-3 rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-bold">{plan.sheet_number}</span><span className="text-xs text-[var(--bos-text-muted)]">{plan.discipline}</span></div><p className="mt-1 text-sm font-semibold">{plan.title}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">Revision {plan.revision_label} · Version {plan.version_number}{plan.issued_at ? ` · Issued ${formatDate(plan.issued_at)}` : ""}</p></div>{plan.url ? <a href={plan.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-4 text-sm font-semibold hover:bg-[var(--bos-bg-hover)]">Open Plan</a> : <span className="text-xs text-[var(--bos-text-muted)]">File unavailable</span>}</article>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-5 text-sm text-[var(--bos-text-secondary)]">No approved plans have been published for this assignment yet.</p>}
          </section>
        </div>

        <section id="messages" className="h-fit rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)] xl:sticky xl:top-24">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8ec3ff]">Project Communication</p><h2 className="mt-1 text-xl font-semibold">Messages</h2><p className="mt-1 text-xs text-[var(--bos-text-muted)]">This thread is limited to your company and this assigned project.</p>
          <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">{messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[88%] rounded-xl px-3 py-2.5 ${message.is_mine ? "ml-auto bg-blue-600 text-white" : "bg-[var(--bos-bg-root)] text-[var(--bos-text-primary)]"}`}><p className="whitespace-pre-wrap text-sm leading-5">{message.body}</p><p className={`mt-1 text-[10px] ${message.is_mine ? "text-blue-100" : "text-[var(--bos-text-muted)]"}`}>{message.is_mine ? "You" : message.sender_type === "internal" ? "B.O.S. Team" : "Trade Partner"} · {formatDateTime(message.created_at)}</p></div>) : <p className="rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-4 text-sm text-[var(--bos-text-secondary)]">No messages yet. Start the project thread below.</p>}</div>
          <form action={sendMessage} className="mt-4 space-y-3"><textarea name="body" required maxLength={4000} rows={4} placeholder="Message the project team…" className="w-full rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] p-3 text-sm text-[var(--bos-text-primary)] placeholder:text-[var(--bos-text-muted)]" /><button type="submit" className="h-10 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500">Send Message</button></form>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function formatDate(value: string | null) { if (!value) return "Not scheduled"; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function formatLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatAddress(job: TradePartnerJob) { return [job.address_line_1, job.city, job.state, job.postal_code].filter(Boolean).join(", ") || "Jobsite address not published"; }
