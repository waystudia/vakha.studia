import JSZip from "jszip";
import { loadCatalog, loadClass, loadSchool } from "./repository";
import type { CatalogItem, Child, ParentOrder, School, SchoolClass } from "./types";

type TransferScope = { kind: "class" | "school"; id: string };

function safeName(value: string) { return String(value || "export").replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g, "_").slice(0, 80); }
function serviceRecord(item: CatalogItem) { return { id: item.source_id || item.id, serviceId: item.source_id || item.id, title: item.name, name: item.name, price: Number(item.price), description: item.description || item.short_description || "", shortDescription: item.short_description || "", category: item.category || "", gender: item.gender || "unisex", type: item.type || "photo", previewSrc: item.preview_url || "", previewVideoSrc: item.preview_video_url || "" }; }
function studentRecord(child: Child, classId: string, orders: ParentOrder[]) { const order = orders.find((item) => item.child_id === child.id && item.status !== "cancelled"); const selected = order?.selected_items || []; const serviceIds = selected.map((item) => item.id); return { id: child.id, studentId: child.id, classId, firstName: child.first_name, lastName: child.last_name, publicName: child.public_name, qrId: child.id, catalogId: serviceIds[0] || "", catalogIds: serviceIds, selectedServices: selected.map((item) => ({ serviceId: item.id, quantity: 1, comment: "", name: item.name, price: Number(item.price) })), paymentStatus: "unpaid", orderStatus: order?.status || "", status: order?.status || "" }; }
function orderRecord(order: ParentOrder) { return { id: order.id, orderId: order.id, studentId: order.child_id, status: order.status, catalogId: order.selected_items[0]?.id || "", catalogIds: order.selected_items.map((item) => item.id), items: order.selected_items.map((item) => ({ id: `${order.id}_${item.id}`, taskId: `${order.id}_${item.id}`, type: item.id, serviceId: item.id, title: item.name, price: Number(item.price), status: order.status })), totalAmount: Number(order.total_amount), comment: order.parent_note || "", createdAt: order.created_at, updatedAt: order.updated_at }; }

export async function downloadCrmTransfer(scope: TransferScope) {
  const schoolData = scope.kind === "school" ? await loadSchool(scope.id) : null;
  const classes: SchoolClass[] = schoolData?.classes || [];
  let school: School | null = schoolData?.school || null;
  if (scope.kind === "class") {
    const current = await loadClass(scope.id); classes.push(current.schoolClass); school = current.school;
  }
  const classPayloads = await Promise.all(classes.map((item) => loadClass(item.id)));
  if (!school || !classPayloads.length) throw new Error("Нет данных для экспорта");
  const catalog = await loadCatalog();
  const projectId = `vakha-school-${school.id}`;
  const projects = [{ id: projectId, projectId, name: school.name, schoolName: school.name, city: school.city, address: school.address, createdAt: school.created_at, updatedAt: school.updated_at }];
  const classRecords = classPayloads.map(({ schoolClass }) => ({ id: schoolClass.id, classId: schoolClass.id, projectId, name: schoolClass.name, academicYear: schoolClass.academic_year, teacherName: schoolClass.teacher_name, schoolName: school.name }));
  const children = classPayloads.flatMap(({ schoolClass, children: list, orders }) => list.map((child) => studentRecord(child, schoolClass.id, orders)));
  const orders = classPayloads.flatMap(({ orders: list }) => list.map(orderRecord));
  const usedServices = new Set(children.flatMap((child) => child.catalogIds));
  const services = catalog.filter((item) => !usedServices.size || usedServices.has(item.id) || usedServices.has(item.source_id)).map(serviceRecord);
  const data = { projects, classes: classRecords, students: children, services, orders, operators: [], operatorEvents: [], media: [], finalWorks: [], documents: [], settings: [], checklistTemplates: [], templates: [], tasks: orders.flatMap((order) => order.items.map((item) => ({ ...item, orderId: order.id, studentId: order.studentId }))), statuses: [] };
  const manifest = { app: "Vakha Studio", schemaVersion: 1, exportType: scope.kind, exportedAt: new Date().toISOString(), exportedBy: "vakha.studia", containsMedia: false, counts: { classes: classRecords.length, students: children.length, orders: orders.length, services: services.length } };
  const zip = new JSZip(); zip.file("manifest.json", JSON.stringify(manifest, null, 2)); zip.file("data.json", JSON.stringify(data, null, 2)); zip.file("README.txt", "Архив подготовлен в формате Vakha Studio для импорта в CRM Photo. Откройте импорт ZIP проекта или класса.");
  const blob = await zip.generateAsync({ type: "blob" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `Vakha_${safeName(school.name)}_${scope.kind}_${new Date().toISOString().slice(0, 10)}.zip`; anchor.click(); URL.revokeObjectURL(url);
}
