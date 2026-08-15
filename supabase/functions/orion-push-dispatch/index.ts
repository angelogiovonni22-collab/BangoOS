import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "npm:web-push@3.6.7";

const corsHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "POST required" }), { status: 405, headers: corsHeaders });

  const dispatchSecret = Deno.env.get("ORION_PUSH_DISPATCH_SECRET") || "";
  const suppliedSecret = req.headers.get("x-orion-push-secret") || "";
  if (!dispatchSecret || suppliedSecret !== dispatchSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const vapidPublicKey = Deno.env.get("ORION_VAPID_PUBLIC_KEY") || "";
  const vapidPrivateKey = Deno.env.get("ORION_VAPID_PRIVATE_KEY") || "";
  const vapidSubject = Deno.env.get("ORION_VAPID_SUBJECT") || "mailto:notifications@bango-os.vercel.app";
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({ ok: false, error: "Push environment is incomplete." }), { status: 503, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  const { data: reminders, error: reminderError } = await supabase
    .from("orion_reminders")
    .select("id,company_id,user_id,title,message,due_at,event_title,event_starts_at,linked_href,delivery_attempts")
    .lte("due_at", now)
    .is("cancelled_at", null)
    .is("delivered_at", null)
    .order("due_at", { ascending: true })
    .limit(100);

  if (reminderError) return new Response(JSON.stringify({ ok: false, error: reminderError.message }), { status: 500, headers: corsHeaders });
  if (!reminders?.length) return new Response(JSON.stringify({ ok: true, processed: 0, delivered: 0 }), { headers: corsHeaders });

  let delivered = 0;
  for (const reminder of reminders) {
    const { data: subscriptions } = await supabase
      .from("orion_push_subscriptions")
      .select("id,endpoint,p256dh,auth_key")
      .eq("company_id", reminder.company_id)
      .eq("user_id", reminder.user_id);

    let successCount = 0;
    const errors: string[] = [];
    for (const subscription of subscriptions || []) {
      try {
        const payload = JSON.stringify({
          title: reminder.title || "Orion reminder",
          body: reminder.message || reminder.event_title || "You have an Orion reminder.",
          href: reminder.linked_href || "/mobile-entry",
          tag: `orion-${reminder.id}`,
          reminderId: reminder.id,
        });
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
        }, payload, {
          TTL: 60 * 60 * 24,
          urgency: "high",
          vapidDetails: { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
        });
        successCount += 1;
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("orion_push_subscriptions").delete().eq("id", subscription.id);
        }
        errors.push(error instanceof Error ? error.message : "Push delivery failed");
      }
    }

    if (successCount > 0) {
      delivered += 1;
      await supabase.from("orion_reminders").update({
        delivered_at: new Date().toISOString(),
        delivery_attempts: Number(reminder.delivery_attempts || 0) + 1,
        last_delivery_error: errors.length ? errors.join(" | ").slice(0, 2000) : null,
      }).eq("id", reminder.id);
    } else {
      await supabase.from("orion_reminders").update({
        delivery_attempts: Number(reminder.delivery_attempts || 0) + 1,
        last_delivery_error: subscriptions?.length ? errors.join(" | ").slice(0, 2000) : "No active push subscription for this user.",
      }).eq("id", reminder.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: reminders.length, delivered }), { headers: corsHeaders });
});
