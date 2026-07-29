import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "https://ducks-academy-crm.vercel.app";

    if (!vapidPublic || !vapidPrivate) throw new Error("Faltan los secretos VAPID.");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { announcement_id } = await req.json();
    if (!announcement_id) throw new Error("Falta announcement_id.");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: announcement, error: announcementError } = await admin
      .from("portal_announcements_v124")
      .select("*")
      .eq("id", announcement_id)
      .single();
    if (announcementError || !announcement) throw announcementError || new Error("Aviso no encontrado.");

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("parent_push_subscriptions_v124")
      .select("id,subscription")
      .eq("active", true);
    if (subscriptionsError) throw subscriptionsError;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const payload = JSON.stringify({
      title: `${announcement.kind === "event" ? "📅" : "📣"} ${announcement.title}`,
      body: announcement.message,
      announcement_id: announcement.id,
      tag: `ducks-announcement-${announcement.id}`,
      url: "./",
      icon: "./assets/pwa-icon-192.png",
      badge: "./assets/pwa-icon-192.png",
    });

    let sent = 0;
    let failed = 0;
    for (const row of subscriptions || []) {
      try {
        await webpush.sendNotification(row.subscription, payload, { TTL: 86400 });
        sent++;
      } catch (err) {
        failed++;
        const statusCode = Number((err as { statusCode?: number }).statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("parent_push_subscriptions_v124").update({ active: false }).eq("id", row.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
