import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  searchCatalogInstitutions: vi.fn(async () => [{
    id: "school-1",
    name: "Детский сад №24",
    city: "Грозный",
    classes: [{ id: "class-1", name: "Младшая группа", academic_year: "2026/2027" }],
  }]),
  submitCatalogIntake: vi.fn(async () => ({
    inquiry_id: "inquiry-1",
    school_id: "school-1",
    class_id: "class-1",
    child_id: "child-1",
    order_id: "order-1",
    order_number: "VS-12345678",
    institution: "Детский сад №24",
    city: "Грозный",
    group_name: "Младшая группа",
  })),
}));

vi.mock("../lib/repository", () => repository);

import { CatalogInquiry } from "./CatalogInquiry";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CatalogInquiry project intake", () => {
  it("offers a matching institution and group, then attaches the child to them", async () => {
    render(<CatalogInquiry token="catalog-token" items={[{ id: "item-1", name: "Фото", price: 350 }]} open onClose={() => undefined}/>);

    fireEvent.change(screen.getByLabelText("Название учреждения"), { target: { value: "садик 24" } });
    fireEvent.click(await screen.findByRole("button", { name: /Детский сад №24/ }));
    fireEvent.click(screen.getByRole("button", { name: /Младшая группа/ }));
    fireEvent.change(screen.getByLabelText("Фамилия"), { target: { value: "Иванова" } });
    fireEvent.change(screen.getByLabelText("Имя"), { target: { value: "Амина" } });
    fireEvent.change(screen.getByLabelText("Телефон родителя"), { target: { value: "+7 999 111-22-33" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Отправить заявку" }).closest("form")!);

    await waitFor(() => expect(repository.submitCatalogIntake).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-1",
      classId: "class-1",
      childFirstName: "Амина",
      childLastName: "Иванова",
    })));
    expect(await screen.findByText("Готово — ребёнок добавлен")).toBeTruthy();
  });
});
