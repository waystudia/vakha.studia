import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const maxFileSize = 5 * 1024 * 1024;
const maxVideoSize = 25 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function extensionFor(file: File) {
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

function videoExtensionFor(file: File) {
  return file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
}

function validVideo(bytes: Uint8Array, type: string) {
  if (type === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
}

function validImage(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);

  let uploadedPath = "";
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Сервер вложений не настроен");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    if (req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.json().catch(() => ({})) as { action?: string; token?: string };
      const token = String(body.token || "").trim();
      if (body.action !== "signPreviews" || !/^[a-zA-Z0-9_-]{32,160}$/.test(token)) return json({ error: "Запрос недействителен" }, 400);
      const { data: schoolClass, error: classError } = await admin.from("classes").select("id, owner_id, name, public_expires_at").eq("public_token", token).eq("status", "active").maybeSingle();
      if (classError) throw classError;
      if (!schoolClass || (schoolClass.public_expires_at && Date.parse(schoolClass.public_expires_at) <= Date.now())) return json({ error: "Ссылка недействительна или просрочена" }, 403);
      const { data: orders, error: ordersError } = await admin.from("parent_orders").select("selected_items").eq("class_id", schoolClass.id).neq("status", "cancelled");
      if (ordersError) throw ordersError;
      const prefix = `${schoolClass.owner_id}/${schoolClass.id}/`;
      const paths = [...new Set((orders || []).flatMap((order) => (order.selected_items as Array<Record<string, unknown>> || [])
        .flatMap((item) => [String(item.reference_path || ""), String(item.parent_video_path || "")])
        .filter((path) => path.startsWith(prefix))))];
      const signed = await Promise.all(paths.map(async (path) => {
        const { data } = await admin.storage.from("parent-request-references").createSignedUrl(path, 60 * 60);
        return data?.signedUrl ? [path, data.signedUrl] as const : null;
      }));
      return json({ previews: Object.fromEntries(signed.filter((item): item is readonly [string, string] => Boolean(item))) });
    }

    const form = await req.formData();
    const mode = String(form.get("mode") || "");
    const token = String(form.get("token") || "").trim();
    const childId = String(form.get("childId") || "").trim();
    const message = String(form.get("message") || "").trim().slice(0, 1000);
    const requestKey = String(form.get("requestKey") || "").trim();
    const catalogItemId = String(form.get("catalogItemId") || "").trim() || null;
    const reference = form.get("reference");

    if (!/^[a-zA-Z0-9_-]{32,160}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(childId) || (mode !== "attachServiceVideo" && !/^[0-9a-f-]{36}$/i.test(requestKey))) {
      return json({ error: "Ссылка или данные запроса недействительны" }, 400);
    }
    if (catalogItemId && !/^[0-9a-f-]{36}$/i.test(catalogItemId)) return json({ error: "Услуга выбрана неверно" }, 400);
    if (message.length < 3 && !catalogItemId && !(reference instanceof File)) return json({ error: "Опишите идею или прикрепите референс" }, 400);

    const { data: schoolClass, error: classError } = await admin.from("classes").select("id, owner_id, name, public_expires_at").eq("public_token", token).eq("status", "active").maybeSingle();
    if (classError) throw classError;
    if (!schoolClass || (schoolClass.public_expires_at && Date.parse(schoolClass.public_expires_at) <= Date.now())) return json({ error: "Ссылка недействительна или просрочена" }, 403);
    const { data: child, error: childError } = await admin.from("children").select("id, public_name").eq("id", childId).eq("class_id", schoolClass.id).eq("status", "active").maybeSingle();
    if (childError) throw childError;
    if (!child) return json({ error: "Ребёнок не найден в этом классе" }, 403);

    if (mode === "attachServiceVideo") {
      const itemId = String(form.get("itemId") || "").trim();
      const video = form.get("video");
      if (!/^[0-9a-f-]{36}$/i.test(itemId) || !(video instanceof File) || !video.size) return json({ error: "Видео или услуга не выбраны" }, 400);
      if (!allowedVideoTypes.has(video.type) || video.size > maxVideoSize) return json({ error: "После сжатия видео должно быть MP4, WebM или MOV и не больше 25 МБ" }, 400);
      const bytes = new Uint8Array(await video.arrayBuffer());
      if (!validVideo(bytes, video.type)) return json({ error: "Файл не похож на видео. Выберите MP4, WebM или MOV." }, 400);
      const { data: storedOrder, error: storedOrderError } = await admin.from("parent_orders").select("id, public_token, status, selected_items, total_amount, order_number, class_id, child_id").eq("child_id", childId).eq("class_id", schoolClass.id).neq("status", "cancelled").order("created_at", {ascending: false}).limit(1).maybeSingle();
      if (storedOrderError) throw storedOrderError;
      if (!storedOrder || !["new", "confirmed"].includes(storedOrder.status)) return json({ error: "Сначала сохраните выбранную услугу" }, 409);
      const selectedItems = storedOrder.selected_items as Array<Record<string, unknown>>;
      const target = selectedItems.find((item) => String(item.id) === itemId);
      if (!target || !target.video_addon_requested) return json({ error: "Для этой услуги не выбрано оживление фотографии" }, 400);
      uploadedPath = `${schoolClass.owner_id}/${schoolClass.id}/${childId}/service-video-${itemId}-${crypto.randomUUID()}.${videoExtensionFor(video)}`;
      const { error: uploadError } = await admin.storage.from("parent-request-references").upload(uploadedPath, bytes, {contentType: video.type, cacheControl: "31536000", upsert: false});
      if (uploadError) throw uploadError;
      const updatedItems = selectedItems.map((item) => String(item.id) === itemId ? {...item, parent_video_path: uploadedPath, parent_video_name: video.name.slice(0, 140), parent_video_content_type: video.type} : item);
      const { error: updateError } = await admin.from("parent_orders").update({selected_items: updatedItems}).eq("id", storedOrder.id);
      if (updateError) throw updateError;
      uploadedPath = "";
      return json({duplicate: false, updated: true, order_number: storedOrder.order_number, public_token: storedOrder.public_token, status: storedOrder.status, selected_items: updatedItems, total_amount: storedOrder.total_amount, child_name: child.public_name, class_name: schoolClass.name});
    }

    if (reference instanceof File && reference.size > 0) {
      if (!allowedTypes.has(reference.type) || reference.size > maxFileSize) return json({ error: "Прикрепите JPG, PNG или WebP не больше 5 МБ" }, 400);
      const bytes = new Uint8Array(await reference.arrayBuffer());
      if (!validImage(bytes, reference.type)) return json({ error: "Файл не похож на изображение. Выберите JPG, PNG или WebP." }, 400);
      uploadedPath = `${schoolClass.owner_id}/${schoolClass.id}/${childId}/${crypto.randomUUID()}.${extensionFor(reference)}`;
      const { error: uploadError } = await admin.storage.from("parent-request-references").upload(uploadedPath, bytes, { contentType: reference.type, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
    }

    const { data: order, error: orderError } = await admin.rpc("submit_parent_custom_request", {
      p_token: token,
      p_child_id: childId,
      p_message: message || (uploadedPath ? "Референс на скрине" : ""),
      p_request_key: requestKey,
      p_catalog_item_id: catalogItemId,
    });
    if (orderError) throw orderError;

    if (uploadedPath) {
      const { data: storedOrder, error: storedOrderError } = await admin.from("parent_orders").select("id, selected_items").eq("public_token", order.public_token).single();
      if (storedOrderError) throw storedOrderError;
      const selectedItems = (storedOrder.selected_items as Array<Record<string, unknown>>).map((item) => item.request_key === requestKey ? {
        ...item,
        reference_path: uploadedPath,
        reference_name: reference instanceof File ? reference.name.slice(0, 140) : "Референс",
        reference_content_type: reference instanceof File ? reference.type : "",
      } : item);
      const { error: updateError } = await admin.from("parent_orders").update({ selected_items: selectedItems }).eq("id", storedOrder.id);
      if (updateError) throw updateError;
      const { data: signedReference } = await admin.storage.from("parent-request-references").createSignedUrl(uploadedPath, 60 * 60);
      order.selected_items = selectedItems.map((item) => item.request_key === requestKey && signedReference?.signedUrl
        ? { ...item, preview_url: signedReference.signedUrl }
        : item);
    }

    return json(order);
  } catch (error) {
    if (uploadedPath) {
      try {
        const url = Deno.env.get("SUPABASE_URL"); const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (url && serviceKey) await createClient(url, serviceKey, { auth: { persistSession: false } }).storage.from("parent-request-references").remove([uploadedPath]);
      } catch { /* Preserve the primary request error. */ }
    }
    console.error("Parent request attachment error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Не удалось прикрепить референс. Попробуйте ещё раз." }, 500);
  }
});
