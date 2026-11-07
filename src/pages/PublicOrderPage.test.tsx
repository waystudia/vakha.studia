import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PublicOrderPage } from "./PublicOrderPage";
import { cancelPublicOrder, getPublicClass, submitPublicOrder } from "../lib/publicRepository";

vi.mock("../lib/parentIntroProgress", () => ({ hasWatchedParentIntro: () => true }));
vi.mock("../components/ParentIntro", () => ({ ParentIntro: () => null }));
vi.mock("../lib/publicRepository", () => ({
  getPublicClass: vi.fn(async () => ({
    school: { name: "Школа №1" }, class: { name: "1 А", photo_session_name: "Фотосессия" },
    children: [
      { id: "first", public_name: "Первый ребёнок", orders: [] },
      { id: "last", public_name: "Последний ребёнок", orders: [] },
    ],
    catalog: [{ id: "photo", name: "Первое фото", price: 350, category: "Фото", gender: "unisex", type: "photo", preview_url: "/photo.webp", preview_video_url: "" }],
    whatsapp: {},
  })),
  submitPublicOrder: vi.fn(),
  cancelPublicOrder: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "scrollY", { value: 780, configurable: true });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("child to catalog navigation", () => {
  it("opens the catalog at the top and restores the exact child-list position and focus", async () => {
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    const child = await screen.findByRole("button", { name: /Последний ребёнок/ });
    fireEvent.click(child);
    expect(await screen.findByRole("button", { name: "Назад к списку детей" })).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    fireEvent.click(screen.getByRole("button", { name: "Назад к списку детей" }));
    const restored = await screen.findByRole("button", { name: /Последний ребёнок/ });
    await waitFor(() => expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 780, left: 0, behavior: "instant" }));
    expect(document.activeElement).toBe(restored);
  });

  it("defaults to lamination and submits a 50 ₽ discount when protection is removed", async () => {
    vi.mocked(submitPublicOrder).mockResolvedValue({
      duplicate: false,
      order_number: "VS-1",
      status: "new",
      selected_items: [{ id: "photo", name: "Первое фото", price: 300, type: "photo", comment: "Без ламинации (защиты)" }],
      total_amount: 300,
      child_name: "Первый ребёнок",
      class_name: "1 А",
      public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    expect(screen.getByRole("radio", { name: /С защитой.*350/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: /Без защиты.*300/ }));
    expect(screen.getByText(/Итого:.*300/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Оформить заявку" }));
    await waitFor(() => expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({ itemIds: ["photo"], withoutLaminationIds: ["photo"] })));
  });

  it("restores an existing order so a parent can replace or add services", async () => {
    vi.mocked(getPublicClass).mockResolvedValueOnce({
      school: { name: "Школа №1", city: "" }, class: { id: "class", name: "1 А", academic_year: "2026", photo_session_name: "Фотосессия" },
      children: [{ id: "first", public_name: "Первый ребёнок", orders: [{ status: "new", items: [{ id: "photo", name: "Первое фото", comment: "Без ламинации (защиты)" }] }] }],
      catalog: [
        { id: "photo", name: "Первое фото", price: 350, category: "Фото", gender: "unisex", type: "photo", preview_url: "/photo.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
        { id: "extra", name: "Дополнительное фото", price: 350, category: "Фото", gender: "unisex", type: "photo", preview_url: "/extra.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
      ], whatsapp: {},
    });
    vi.mocked(submitPublicOrder).mockResolvedValue({
      duplicate: false, updated: true, order_number: "VS-1", status: "new",
      selected_items: [{ id: "photo", name: "Первое фото", price: 300, type: "photo", comment: "Без ламинации (защиты)" }, { id: "extra", name: "Дополнительное фото", price: 350, type: "photo" }],
      total_amount: 650, child_name: "Первый ребёнок", class_name: "1 А", public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    const selectedCardButton = screen.getByRole("button", { name: "Убрать Первое фото из заказа" });
    expect(selectedCardButton.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" }));
    const dock = document.querySelector<HTMLElement>(".order-dock");
    expect(dock).toBeTruthy();
    expect(within(dock!).getByText("Первое фото")).toBeTruthy();
    expect(screen.getAllByRole("radio", { name: /Без защиты.*300/ }).find((item) => item.getAttribute("aria-checked") === "true")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Добавить Дополнительное фото в заказ" }));
    expect(within(dock!).getByText("Первое фото + ещё 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await waitFor(() => expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({ itemIds: ["photo", "extra"], withoutLaminationIds: ["photo"] })));
  });

  it("lets a parent remove the final service and cancel the existing order", async () => {
    vi.mocked(getPublicClass).mockResolvedValueOnce({
      school: { name: "Школа №1", city: "" }, class: { id: "class", name: "1 А", academic_year: "2026", photo_session_name: "Фотосессия" },
      children: [{ id: "first", public_name: "Первый ребёнок", orders: [{ status: "new", items: [{ id: "photo", name: "Первое фото" }] }] }],
      catalog: [{ id: "photo", name: "Первое фото", price: 350, category: "Фото", gender: "unisex", type: "photo", preview_url: "/photo.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" }], whatsapp: {},
    });
    vi.mocked(cancelPublicOrder).mockResolvedValue({
      duplicate: false, updated: true, order_number: "VS-1", status: "cancelled", selected_items: [], total_amount: 0,
      child_name: "Первый ребёнок", class_name: "1 А", public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    fireEvent.click(screen.getByRole("button", { name: "Убрать Первое фото из заказа" }));
    fireEvent.click(screen.getByRole("button", { name: "Да, удалить" }));
    await waitFor(() => expect(cancelPublicOrder).toHaveBeenCalledWith({ token: "test", childId: "first" }));
    expect(await screen.findByText("Заявка удалена. Можно выбрать услуги заново.")).toBeTruthy();
    expect(screen.getByText("Пока без заявки")).toBeTruthy();
  });
});
