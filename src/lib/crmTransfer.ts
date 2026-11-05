import JSZip from "jszip";
import { loadCatalog, loadClass, loadSchool } from "./repository";
import type { CatalogItem, Child, ParentOrder, School, SchoolClass } from "./types";

type TransferScope = { kind: "class" | "school"; id: string };

function safeName(value: string) { return String(value || "export").replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "_").slice(0, 80); }
function serviceRecord(item: CatalogItem) { return { id: item.source_id || item.id, serviceId: item.source_id || item.id, title: item.name, name: item.name, price: Number(item.price), description: item.description || item.short_description || "", shortDescription: item.short_description || "", category: item.category || "", gender: item.gender || "unisex", type: item.type || "photo", previewSrc: item.preview_url || "", previewVideoSrc: item.preview_video_url || "" }; }
export function studentRecord(child: Child, classId: string, orders: ParentOrder[]) { const order = [...orders].filter(item => item.child_id === child.id && item.status !== "cancelled").sort((a,b) => (b.created_at || "").localeCompare(a.created_at || ""))[0]; const selected = order?.selected_items || []; const serviceIds = selected.map((item) => item.id); return { id: child.crm_source_id || child.id, studentId: child.crm_source_id || child.id, classId, firstName: child.first_name, lastName: child.last_name, publicName: child.public_name,  catalogId: serviceIds[0] || "", catalogIds: serviceIds, selectedServices: selected.map((item) => ({ serviceId: item.id, quantity: item.quantity || 1, comment: item.comment || "", name: item.name, price: Number(item.price) })), paymentStatus: "unpaid", orderStatus: order?.status || "", status: order?.status || "" }; }
export function orderRecord(order: ParentOrder) { return { id: `order_${order.child_id}`, orderId: `order_${order.child_id}`, vakhaOrderId: order.id, studentId: order.child_id, status: order.status, catalogId: order.selected_items[0]?.id || "", catalogIds: order.selected_items.map((item) => item.id), items: order.selected_items.map((item) => ({ id: `order_${order.child_id}_${item.id}`, taskId: `order_${order.child_id}_${item.id}`, type: item.id, serviceId: item.id, title: item.name, label: item.name, price: Number(item.price), quantity: item.quantity || 1, comment: item.comment || "", status: order.status })), totalAmount: Number(order.total_amount), comment: order.parent_note || "", createdAt: order.created_at, updatedAt: order.updated_at }; }

export async function buildCrmTransfer(scope: TransferScope) {
  const schoolData = scope.kind === "school" ? await loadSchool(scope.id) : null;
  const classes: SchoolClass[] = schoolData?.classes || [];
  let school: School | null = schoolData?.school || null;
  if (scope.kind === "class") {
    const current = await loadClass(scope.id); classes.push(current.schoolClass); school = current.school;
  }
  const classPayloads = await Promise.all(classes.map((item) => loadClass(item.id)));
  if (!school || !classPayloads.length) throw new Error("Нет данных для экспорта");
  const catalog = await loadCatalog();
  const serviceMap = new Map(catalog.map(item => [item.id, item.source_id || item.id]));
  for (const payload of classPayloads) {
    const studentMap = new Map(payload.children.map(child => [child.id, child.crm_source_id || child.id]));
    payload.orders = payload.orders.map(order => ({...order, child_id: studentMap.get(order.child_id) || order.child_id, selected_items: order.selected_items.map(item => ({...item, id: serviceMap.get(item.id) || item.id}))}));
    payload.children = payload.children.map(child => ({...child, id: studentMap.get(child.id) || child.id}));
  }
  const projectId = school.crm_source_id || `vakha-school-${school.id}`;
  const projects = [{ id: projectId, projectId, name: school.name, schoolName: school.name, city: school.city, address: school.address, createdAt: school.created_at, updatedAt: school.updated_at }];
  const classRecords = classPayloads.map(({ schoolClass }) => ({ id: schoolClass.crm_source_id || schoolClass.id, classId: schoolClass.crm_source_id || schoolClass.id, projectId, name: schoolClass.name, academicYear: schoolClass.academic_year, teacherName: schoolClass.teacher_name, schoolName: school.name }));
  const children = classPayloads.flatMap(({ schoolClass, children: list, orders }) => list.map((child) => studentRecord(child, schoolClass.crm_source_id || schoolClass.id, orders)));
  const orders = classPayloads.flatMap(({ orders: list }) => [...new Map([...list].filter(order => order.status !== "cancelled").sort((a,b) => b.created_at.localeCompare(a.created_at)).map(order => [order.child_id, order] as const).reverse()).values()].map(orderRecord));
  const usedServices = new Set(children.flatMap((child) => child.catalogIds));
  const services = catalog.filter((item) => !usedServices.size || usedServices.has(item.id) || usedServices.has(item.source_id)).map(serviceRecord);
  const data = { projects, classes: classRecords, students: children, services, orders, operators: [], operatorEvents: [], media: [], finalWorks: [], documents: [], settings: [], checklistTemplates: [], templates: [], tasks: orders.flatMap((order) => order.items.map((item) => ({ ...item, orderId: order.id, studentId: order.studentId }))), statuses: [] };
  const manifest = { app: "Vakha Studio", schemaVersion: 1, exportType: scope.kind === "school" ? "project" : "class", scope: scope.kind, exportedAt: new Date().toISOString(), exportedBy: "vakha.studia", containsMedia: false, counts: { classes: classRecords.length, students: children.length, orders: orders.length, services: services.length } };
  const zip = new JSZip(); zip.file("manifest.json", JSON.stringify(manifest, null, 2)); zip.file("data.json", JSON.stringify(data, null, 2)); zip.file("README.txt", `Заявки родителей Vakha Studio. ${scope.kind === "school" ? "Вся школа: все активные классы." : "Один класс."}
Дети, выбранные услуги, количество, комментарии, суммы и текущие неотменённые заявки.
CRM Photo → Настройки → Импорт / экспорт → ${scope.kind === "school" ? "Импорт проекта" : "Импорт класса/группы"}.
Выберите объединение по постоянным ID. Архив не содержит фотографии детей и готовый монтаж; они остаются в CRM.
CSV из списка заявок предназначен для таблиц, для CRM используйте этот ZIP.`);
  const filename = `Vakha_${safeName(school.name)}_${scope.kind === "class" ? safeName(classes[0].name) : "вся_школа"}_${new Date().toISOString().slice(0, 10)}.zip`;
  return {zip, filename, counts: manifest.counts};
}

export async function downloadCrmTransfer(scope: TransferScope) {
  const {zip, filename, counts} = await buildCrmTransfer(scope);
  const blob = await zip.generateAsync({type: "blob"}); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); return counts;
}
