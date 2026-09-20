import { describe, expect, it } from "vitest";
import { parseChildrenFile } from "./childrenImport";

describe("children import", () => {
  it("читает русский CSV и создаёт публичные имена", async () => {
    const csv = "Имя;Фамилия;Публичное имя\nАдам;Абдуллаев;\nМарьям;Хасанова;Марьям Х.";
    const result = await parseChildrenFile(new File([csv], "children.csv", { type: "text/csv" }));
    expect(result).toEqual([
      { first_name: "Адам", last_name: "Абдуллаев", public_name: "Адам А." },
      { first_name: "Марьям", last_name: "Хасанова", public_name: "Марьям Х." },
    ]);
  });

  it("отклоняет файл без распознаваемых колонок", async () => {
    await expect(parseChildrenFile(new File(["Телефон\n123"], "children.csv"))).rejects.toThrow("Не найдены колонки");
  });
});
