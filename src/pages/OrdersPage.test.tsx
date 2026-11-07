import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OrdersPage } from "./OrdersPage";
import { loadOrdersWorkspace, updateOrderStatus } from "../lib/repository";
import type { OrdersWorkspace } from "../lib/types";

vi.mock("../lib/repository", () => ({
  loadOrdersWorkspace: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

const workspace = {
  schools: [
    { id: "school-1", name: "Школа №1", city: "Грозный" },
    { id: "school-2", name: "Гимназия №2", city: "Аргун" },
  ],
  classes: [
    { id: "class-1", school_id: "school-1", name: "1 А", academic_year: "2026/2027", photo_session_name: "Первый класс" },
    { id: "class-2", school_id: "school-1", name: "2 Б", academic_year: "2026/2027", photo_session_name: "Второй класс" },
  ],
  orders: [
    {
      id: "order-1", class_id: "class-1", child_id: "child-1", order_number: "VS-101", status: "new",
      selected_items: [{ id: "photo", name: "Чеченский джигит", price: 350, type: "photo", preview_url: "/jigit.webp" }],
      total_amount: 350, created_at: "2026-11-07T12:00:00Z", parent_note: "",
      child: { first_name: "Али", last_name: "Абдуллаев", public_name: "Али А." },
      class: { name: "1 А", school_id: "school-1", school: { name: "Школа №1" } },
    },
    {
      id: "order-2", class_id: "class-1", child_id: "child-2", order_number: "VS-102", status: "confirmed",
      selected_items: [{ id: "video", name: "Интервью ребёнка", price: 800, type: "video" }],
      total_amount: 800, created_at: "2026-11-07T13:00:00Z", parent_note: "",
      child: { first_name: "Асет", last_name: "Ахмадова", public_name: "Асет А." },
      class: { name: "1 А", school_id: "school-1", school: { name: "Школа №1" } },
    },
    {
      id: "order-cancelled", class_id: "class-1", child_id: "child-cancelled", order_number: "VS-103", status: "cancelled",
      selected_items: [{ id: "old", name: "Отменённый образ", price: 350, type: "photo" }],
      total_amount: 350, created_at: "2026-11-07T14:00:00Z", parent_note: "",
      child: { first_name: "Ребёнок", last_name: "Отменённый", public_name: "Отменённый Р." },
      class: { name: "1 А", school_id: "school-1", school: { name: "Школа №1" } },
    },
  ],
} as unknown as OrdersWorkspace;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadOrdersWorkspace).mockResolvedValue(workspace);
  vi.mocked(updateOrderStatus).mockResolvedValue(workspace.orders[0]);
});

afterEach(() => cleanup());

describe("orders hierarchy", () => {
  it("opens a project, its class, and child cards with selected services", async () => {
    render(<MemoryRouter><OrdersPage/></MemoryRouter>);

    const project = await screen.findByRole("button", { name: /Школа №1/ });
    expect(project.textContent).toContain("2 классов");
    expect(project.textContent).toContain("2 заявок");
    fireEvent.click(project);

    expect(screen.getByRole("heading", { name: "Классы" })).toBeTruthy();
    const schoolClass = screen.getByRole("button", { name: /1 А/ });
    expect(schoolClass.textContent).toContain("2заявок");
    fireEvent.click(schoolClass);

    expect(screen.getByRole("heading", { name: "Карточки детей" })).toBeTruthy();
    expect(screen.getByText("Абдуллаев Али")).toBeTruthy();
    expect(screen.getByText("Чеченский джигит")).toBeTruthy();
    expect(screen.getByText("Ахмадова Асет")).toBeTruthy();
    expect(screen.getByText("Интервью ребёнка")).toBeTruthy();
    expect(screen.queryByText("Отменённый Ребёнок")).toBeNull();
  });

  it("keeps status editing available inside a child order card", async () => {
    render(<MemoryRouter><OrdersPage/></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Школа №1/ }));
    fireEvent.click(screen.getByRole("button", { name: /1 А/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Статус заявки Абдуллаев Али" }), { target: { value: "ready" } });
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledWith("order-1", "ready"));
  });

  it("removes an order from the active workspace when it is cancelled", async () => {
    render(<MemoryRouter><OrdersPage/></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Школа №1/ }));
    fireEvent.click(screen.getByRole("button", { name: /1 А/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Статус заявки Абдуллаев Али" }), { target: { value: "cancelled" } });
    await waitFor(() => expect(screen.queryByText("Абдуллаев Али")).toBeNull());
  });
});
