import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type {
  CatalogItem,
  CatalogZipItem,
  Child,
  ClassWithStats,
  ParentOrder,
  PublicClassPayload,
  PublicOrderResult,
  School,
  SchoolClass,
  SchoolWithStats,
} from "./types";
import { makePublicName } from "./helpers";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function currentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  fail(error);
  return data;
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  fail(error);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  fail(error);
}

export async function ensureDemoData(userId: string) {
  const { count, error: countError } = await supabase
    .from("schools")
    .select("id", { count: "exact", head: true });
  fail(countError);

  if ((count || 0) === 0) {
    const { data: school, error: schoolError } = await supabase
      .from("schools")
      .insert({ owner_id: userId, name: "Лицей №12", city: "Москва" })
      .select("*")
      .single();
    fail(schoolError);

    const { data: schoolClass, error: classError } = await supabase
      .from("classes")
      .insert({
        owner_id: userId,
        school_id: school.id,
        name: "3А",
        academic_year: "2026/2027",
        teacher_name: "",
        photo_session_name: "Фотосессия 3А",
      })
      .select("*")
      .single();
    fail(classError);

    const demoChildren = [
      { first_name: "Адам", last_name: "Абдуллаев", public_name: "Адам А." },
      { first_name: "Марьям", last_name: "Хасанова", public_name: "Марьям Х." },
      { first_name: "Амина", last_name: "Магомедова", public_name: "Амина М." },
    ].map((child) => ({ ...child, owner_id: userId, class_id: schoolClass.id }));
    const { error: childrenError } = await supabase.from("children").insert(demoChildren);
    fail(childrenError);
  }

  const { count: catalogCount, error: catalogCountError } = await supabase
    .from("catalog_items")
    .select("id", { count: "exact", head: true });
  fail(catalogCountError);

  if ((catalogCount || 0) === 0) {
    const defaults = [
      ["default-photo", "Обычные фото", "Классические школьные снимки", "photo", 400],
      ["default-ai-image", "AI-образ", "Стильный цифровой портрет", "ai", 400],
      ["default-ai-video", "AI-видео", "Короткий ролик с анимацией", "video", 300],
      ["default-interview", "Интервью", "Несколько вопросов о мечтах и планах", "interview", 300],
    ].map(([source_id, name, short_description, type, price], sort_order) => ({
      owner_id: userId,
      source_id,
      name,
      short_description,
      description: short_description,
      type,
      category: "Базовый каталог",
      price,
      sort_order,
      source: "demo",
    }));
    const { error } = await supabase.from("catalog_items").insert(defaults);
    fail(error);
  }
}

export async function loadSchools(): Promise<SchoolWithStats[]> {
  const [schoolsResult, classesResult, childrenResult, ordersResult] = await Promise.all([
    supabase.from("schools").select("*").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("classes").select("id, school_id").eq("status", "active"),
    supabase.from("children").select("id, class_id").eq("status", "active"),
    supabase.from("parent_orders").select("id, class_id").neq("status", "cancelled"),
  ]);
  [schoolsResult.error, classesResult.error, childrenResult.error, ordersResult.error].forEach(fail);

  const classes = classesResult.data || [];
  const children = childrenResult.data || [];
  const orders = ordersResult.data || [];
  return ((schoolsResult.data || []) as School[]).map((school) => {
    const classIds = classes.filter((item) => item.school_id === school.id).map((item) => item.id);
    return {
      ...school,
      classes_count: classIds.length,
      children_count: children.filter((item) => classIds.includes(item.class_id)).length,
      orders_count: orders.filter((item) => classIds.includes(item.class_id)).length,
    };
  });
}

export async function createSchool(input: Pick<School, "name" | "city" | "address" | "contact_name">) {
  const { data, error } = await supabase.from("schools").insert(input).select("*").single();
  fail(error);
  return data as School;
}

export async function updateSchool(id: string, input: Partial<Pick<School, "name" | "city" | "address" | "contact_name" | "status">>) {
  const { data, error } = await supabase.from("schools").update(input).eq("id", id).select("*").single();
  fail(error);
  return data as School;
}

export async function loadSchool(id: string): Promise<{ school: School; classes: ClassWithStats[] }> {
  const [schoolResult, classesResult, childrenResult, ordersResult] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("classes").select("*").eq("school_id", id).eq("status", "active").order("created_at"),
    supabase.from("children").select("id, class_id").eq("status", "active"),
    supabase.from("parent_orders").select("id, class_id, child_id").neq("status", "cancelled"),
  ]);
  [schoolResult.error, classesResult.error, childrenResult.error, ordersResult.error].forEach(fail);
  const children = childrenResult.data || [];
  const orders = ordersResult.data || [];
  const classes = ((classesResult.data || []) as SchoolClass[]).map((item) => {
    const classChildren = children.filter((child) => child.class_id === item.id);
    const orderedChildIds = new Set(orders.filter((order) => order.class_id === item.id).map((order) => order.child_id));
    return {
      ...item,
      children_count: classChildren.length,
      orders_count: orders.filter((order) => order.class_id === item.id).length,
      missing_orders_count: classChildren.filter((child) => !orderedChildIds.has(child.id)).length,
    };
  });
  return { school: schoolResult.data as School, classes };
}

export async function createClass(input: Pick<SchoolClass, "school_id" | "name" | "academic_year" | "teacher_name" | "photo_session_name">) {
  const { data, error } = await supabase.from("classes").insert(input).select("*").single();
  fail(error);
  return data as SchoolClass;
}

export async function updateClass(id: string, input: Partial<Pick<SchoolClass, "name" | "academic_year" | "teacher_name" | "photo_session_name" | "status" | "public_expires_at">>) {
  const { data, error } = await supabase.from("classes").update(input).eq("id", id).select("*").single();
  fail(error);
  return data as SchoolClass;
}

export async function loadClass(id: string): Promise<{
  schoolClass: SchoolClass;
  school: School;
  children: Child[];
  orders: ParentOrder[];
}> {
  const classResult = await supabase.from("classes").select("*").eq("id", id).single();
  fail(classResult.error);
  const schoolClass = classResult.data as SchoolClass;
  const [schoolResult, childrenResult, ordersResult] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolClass.school_id).single(),
    supabase.from("children").select("*").eq("class_id", id).eq("status", "active").order("last_name"),
    supabase.from("parent_orders").select("*").eq("class_id", id).order("created_at", { ascending: false }),
  ]);
  [schoolResult.error, childrenResult.error, ordersResult.error].forEach(fail);
  return {
    schoolClass,
    school: schoolResult.data as School,
    children: (childrenResult.data || []) as Child[],
    orders: (ordersResult.data || []) as ParentOrder[],
  };
}

export async function createChild(classId: string, input: { first_name: string; last_name: string; public_name?: string }) {
  const payload = {
    class_id: classId,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    public_name: input.public_name?.trim() || makePublicName(input.first_name, input.last_name),
  };
  const { data, error } = await supabase.from("children").insert(payload).select("*").single();
  fail(error);
  return data as Child;
}

export async function updateChild(id: string, input: Partial<Pick<Child, "first_name" | "last_name" | "public_name" | "status">>) {
  const { data, error } = await supabase.from("children").update(input).eq("id", id).select("*").single();
  fail(error);
  return data as Child;
}

export async function importChildren(classId: string, rows: Array<{ first_name: string; last_name: string; public_name?: string }>) {
  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      await createChild(classId, row);
      added += 1;
    } catch (error) {
      if (error instanceof Error && error.message.includes("children_active_name_unique")) skipped += 1;
      else throw error;
    }
  }
  return { added, skipped };
}

export async function loadCatalog(): Promise<CatalogItem[]> {
  const { data, error } = await supabase.from("catalog_items").select("*").order("sort_order").order("name");
  fail(error);
  return (data || []) as CatalogItem[];
}

function extensionForBlob(blob: Blob, fallbackPath: string) {
  const fromPath = fallbackPath.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (fromPath) return fromPath;
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "video/mp4") return "mp4";
  return "jpg";
}

async function uploadCatalogAsset(userId: string, sourceId: string, kind: string, blob: Blob | undefined, originalPath: string) {
  if (!blob) return "";
  const safeSource = sourceId.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80);
  const path = `${userId}/${safeSource}/${kind}.${extensionForBlob(blob, originalPath)}`;
  const { error } = await supabase.storage.from("catalog-previews").upload(path, blob, {
    contentType: blob.type,
    upsert: true,
  });
  fail(error);
  return supabase.storage.from("catalog-previews").getPublicUrl(path).data.publicUrl;
}

export async function importCatalogItems(userId: string, items: CatalogZipItem[], onProgress?: (done: number, total: number) => void) {
  const existing = await loadCatalog();
  const existingBySource = new Map(existing.map((item) => [item.source_id, item]));
  for (const [index, item] of items.entries()) {
    const previous = existingBySource.get(item.sourceId);
    const previewUrl = item.previewImage
      ? await uploadCatalogAsset(userId, item.sourceId, "preview", item.previewImage, item.previewImagePath)
      : previous?.preview_url || "";
    const previewVideoUrl = item.previewVideo
      ? await uploadCatalogAsset(userId, item.sourceId, "preview-video", item.previewVideo, item.previewVideoPath)
      : previous?.preview_video_url || "";
    const payload = {
      owner_id: userId,
      source_id: item.sourceId,
      name: item.name,
      description: item.description,
      short_description: item.shortDescription,
      type: item.type,
      category: item.category,
      price: item.price,
      preview_url: previewUrl,
      preview_video_url: previewVideoUrl,
      is_active: true,
      sort_order: index,
      source: "crm_photo_zip",
    };
    const { error } = await supabase.from("catalog_items").upsert(payload, { onConflict: "owner_id,source_id" });
    fail(error);
    onProgress?.(index + 1, items.length);
  }
  return items.length;
}

export async function updateCatalogItem(id: string, input: Partial<Pick<CatalogItem, "name" | "description" | "short_description" | "price" | "is_active" | "sort_order">>) {
  const { data, error } = await supabase.from("catalog_items").update(input).eq("id", id).select("*").single();
  fail(error);
  return data as CatalogItem;
}

export async function loadOrders(): Promise<ParentOrder[]> {
  const { data, error } = await supabase
    .from("parent_orders")
    .select("*, child:children(first_name,last_name,public_name), class:classes(name,school_id,school:schools(name))")
    .order("created_at", { ascending: false });
  fail(error);
  return (data || []) as unknown as ParentOrder[];
}

export async function updateOrderStatus(id: string, status: ParentOrder["status"]) {
  const { data, error } = await supabase.from("parent_orders").update({ status }).eq("id", id).select("*").single();
  fail(error);
  return data as ParentOrder;
}

export async function getPublicClass(token: string): Promise<PublicClassPayload | null> {
  const { data, error } = await supabase.rpc("get_public_class", { p_token: token });
  fail(error);
  return data as PublicClassPayload | null;
}

export async function submitPublicOrder(input: {
  token: string;
  childId: string;
  itemIds: string[];
  requestKey: string;
  note: string;
}): Promise<PublicOrderResult> {
  const { data, error } = await supabase.rpc("submit_parent_order", {
    p_token: input.token,
    p_child_id: input.childId,
    p_item_ids: input.itemIds,
    p_request_key: input.requestKey,
    p_parent_note: input.note,
  });
  fail(error);
  return data as PublicOrderResult;
}
