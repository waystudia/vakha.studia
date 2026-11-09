import type { ClassWithStats, School } from "./types";

export const CRM_CLASS_LINKS_FORMAT = "vakha-studia-class-links";

export function buildCrmClassLinks(school: School, classes: ClassWithStats[], origin = window.location.origin) {
  const projectId = school.crm_source_id || "";
  if (!projectId) throw new Error("Школа не привязана к проекту CRM Photo. Сначала импортируйте проект из CRM.");
  const links = classes.map((item) => ({
    projectId,
    classId: item.crm_source_id || "",
    url: item.public_token ? new URL(`${import.meta.env.BASE_URL}?/p/${encodeURIComponent(item.public_token)}`, `${origin}/`).toString() : "",
    token: item.public_token || ""
  })).filter((item) => item.classId && item.url);
  return { format: CRM_CLASS_LINKS_FORMAT, schemaVersion: 1, exportedAt: new Date().toISOString(), projectId, links };
}

export function downloadCrmClassLinks(school: School, classes: ClassWithStats[]) {
  const payload = buildCrmClassLinks(school, classes);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Vakha_links_${school.name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return payload.links.length;
}
