import { describe, expect, it } from "vitest";
import { makePublicName, money } from "./helpers";

describe("helpers", () => {
  it("создаёт безопасное публичное имя", () => {
    expect(makePublicName("Адам", "Абдуллаев")).toBe("Адам А.");
    expect(makePublicName(" Марьям ", " Хасанова ")).toBe("Марьям Х.");
  });

  it("форматирует итог заказа в рублях", () => {
    expect(money(1100)).toContain("1 100");
  });
});
