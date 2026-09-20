import { readSheet } from "read-excel-file/browser";
import { makePublicName } from "./helpers";

export interface ImportedChild {
  first_name: string;
  last_name: string;
  public_name: string;
}

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

function rowsFromCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const delimiter = (lines[0].match(/;/g)?.length || 0) >= (lines[0].match(/,/g)?.length || 0) ? ";" : ",";
  return lines.map((line) => splitCsvLine(line, delimiter));
}

function rowsToChildren(rows: unknown[][]) {
  const headers = (rows[0] || []).map((value) => String(value || "").trim().toLowerCase());
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const firstIndex = indexOf("имя", "first_name", "first name");
  const lastIndex = indexOf("фамилия", "last_name", "last name");
  const fullIndex = indexOf("фио", "fio", "полное имя");
  const publicIndex = indexOf("публичное имя", "public_name");
  const result: ImportedChild[] = [];
  for (const row of rows.slice(1)) {
    const full = fullIndex >= 0 ? String(row[fullIndex] || "").trim().split(/\s+/) : [];
    const firstName = firstIndex >= 0 ? String(row[firstIndex] || "").trim() : full.length > 1 ? full.slice(1).join(" ") : full[0] || "";
    const lastName = lastIndex >= 0 ? String(row[lastIndex] || "").trim() : full.length > 1 ? full[0] : "";
    if (!firstName || !lastName) continue;
    const publicName = publicIndex >= 0 ? String(row[publicIndex] || "").trim() : "";
    result.push({ first_name: firstName, last_name: lastName, public_name: publicName || makePublicName(firstName, lastName) });
  }
  if (!result.length) throw new Error("Не найдены колонки «Имя» и «Фамилия» или «ФИО»");
  return result;
}

export async function parseChildrenFile(file: File) {
  if (file.name.toLowerCase().endsWith(".csv")) return rowsToChildren(rowsFromCsv(await file.text()));
  if (/\.xlsx?$/i.test(file.name)) return rowsToChildren(await readSheet(file));
  throw new Error("Поддерживаются файлы CSV, XLS и XLSX");
}
