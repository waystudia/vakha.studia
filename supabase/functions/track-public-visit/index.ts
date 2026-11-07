import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clientIp(req: Request) {
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

async function hmac(value: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ recorded: false }, 405);

  try {
    const body = await req.json() as { token?: unknown; pageKind?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const pageKind = body.pageKind === "class" || body.pageKind === "catalog" ? body.pageKind : "";
    if (!/^[a-zA-Z0-9_-]{32,160}$/.test(token) || !pageKind) return json({ recorded: false }, 202);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Analytics server is not configured");

    // The raw address exists only in memory for HMAC and is never stored or returned.
    const visitorHash = await hmac(clientIp(req), serviceKey);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc("record_public_visit", {
      p_token: token,
      p_page_kind: pageKind,
      p_visitor_hash: visitorHash,
    });
    if (error) throw error;
    return json(data || { recorded: false }, 202);
  } catch (error) {
    console.error("Visit analytics error", error instanceof Error ? error.message : "unknown");
    // Analytics is best-effort and must never block the public catalog.
    return json({ recorded: false }, 202);
  }
});
