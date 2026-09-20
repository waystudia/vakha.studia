import type { OrderStatus } from "./types";

export const money = (value: number | string) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function makePublicName(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  return `${first}${last ? ` ${last.slice(0, 1).toUpperCase()}.` : ""}`;
}

export function humanError(error: unknown, fallback = "Не удалось выполнить действие") {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("children_active_name_unique")) return "Такой ребёнок уже есть в классе";
  if (message.includes("classes_school_id_name_academic_year_key")) return "Такой класс уже создан";
  if (message.includes("Invalid login credentials")) return "Неверная почта или пароль";
  if (message.includes("Email not confirmed")) return "Подтвердите почту по письму Supabase";
  if (message.includes("User already registered")) return "Аккаунт с такой почтой уже зарегистрирован";
  return message || fallback;
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  new: "Новая",
  confirmed: "Подтверждена",
  in_progress: "В работе",
  ready: "Готово",
  cancelled: "Отменена",
};

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadCsv(fileName: string, rows: unknown[][]) {
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
