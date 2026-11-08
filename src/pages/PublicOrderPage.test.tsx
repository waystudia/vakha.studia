import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PublicOrderPage } from "./PublicOrderPage";
import { cancelPublicOrder, getPublicClass, submitPublicCustomRequest, submitPublicOrder } from "../lib/publicRepository";
import { hasWatchedParentIntro } from "../lib/parentIntroProgress";

vi.mock("../lib/parentIntroProgress", () => ({ hasWatchedParentIntro: vi.fn(() => true) }));
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
  attachPublicServiceVideo: vi.fn(),
  submitPublicCustomRequest: vi.fn(),
  cancelPublicOrder: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasWatchedParentIntro).mockReturnValue(true);
  Object.defineProperty(window, "scrollY", { value: 780, configurable: true });
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: vi.fn(), configurable: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("child to catalog navigation", () => {
  it("shows branded progress while the public class is loading", async () => {
    vi.mocked(getPublicClass).mockReturnValueOnce(new Promise(() => {}));
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Загружаем каталог" })).toBeTruthy();
    expect(screen.getByText("Khan Zama")).toBeTruthy();
    expect(screen.getByText("Подождите, скоро загрузится")).toBeTruthy();
  });

  it("opens the catalog even when the intro video has not been watched", async () => {
    vi.mocked(hasWatchedParentIntro).mockReturnValueOnce(false);
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    expect(await screen.findByRole("button", { name: "Назад к списку детей" })).toBeTruthy();
    expect(screen.queryByText("Сначала посмотрите видео")).toBeNull();
  });

  it("shows the parent child list in Russian alphabetical order", async () => {
    vi.mocked(getPublicClass).mockResolvedValueOnce({
      school: { name: "Школа №1", city: "" }, class: { id: "class", name: "1 А", academic_year: "2026", photo_session_name: "Фотосессия" },
      children: [
        { id: "z", public_name: "Якубов Иса", orders: [] },
        { id: "a2", public_name: "Абдуллаев Али 10", orders: [] },
        { id: "a1", public_name: "Абдуллаев Али 2", orders: [] },
        { id: "g", public_name: "Гараев Абдул-Хамид", orders: [] },
      ],
      catalog: [], whatsapp: {},
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    const names = (await screen.findAllByRole("button")).filter((button) => button.classList.contains("child-choice")).map((button) => button.querySelector("strong")?.textContent);
    expect(names).toEqual(["Абдуллаев Али 2", "Абдуллаев Али 10", "Гараев Абдул-Хамид", "Якубов Иса"]);
  });

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

  it("shows themed category previews and scrolls to the selected section", async () => {
    vi.mocked(getPublicClass).mockResolvedValueOnce({
      school: { name: "Школа №1", city: "" }, class: { id: "class", name: "1 А", academic_year: "2026", photo_session_name: "Фотосессия" },
      children: [{ id: "first", public_name: "Первый ребёнок", orders: [] }],
      catalog: [
        { id: "interview-boy", name: "Интервью ребёнка", price: 800, category: "Фото с видео", gender: "boys", type: "interview", preview_url: "/interview-boy.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
        { id: "interview-girl", name: "Интервью девочки", price: 800, category: "Фото с видео", gender: "girls", type: "interview", popular: true, preview_url: "/interview-girl.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
        { id: "dragon", name: "Полёт на драконе — ИИ-видео", price: 1200, category: "ИИ-видео", gender: "unisex", type: "video", preview_url: "/dragon.webp", preview_video_url: "/dragon.mp4", description: "", short_description: "", parent_preview_mode: "auto" },
        { id: "vainakh-girl", name: "Девочка у башни", price: 350, category: "Детские образы", gender: "girls", type: "photo", preview_url: "/vainakh-girl.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
        { id: "fighter-boy", name: "Супермен", price: 350, category: "Детские образы", gender: "boys", type: "photo", popular: true, preview_url: "/fighter-boy.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
        { id: "fairytale-girl", name: "Сказочная принцесса", price: 350, category: "Детские образы", gender: "girls", type: "photo", preview_url: "/fairytale-girl.webp", preview_video_url: "", description: "", short_description: "", parent_preview_mode: "auto" },
      ], whatsapp: {},
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    const popular = screen.getByRole("region", { name: "Популярные услуги" });
    expect(within(popular).getByText("Интервью девочки")).toBeTruthy();
    expect(within(popular).getByText("Супермен")).toBeTruthy();
    const fighterSection = screen.getByRole("heading", { name: "Бойцовские и герои" }).closest("section");
    expect(fighterSection?.querySelector(".public-catalog-copy strong")?.textContent).toBe("Супермен");
    const allCategories = screen.getByRole("button", { name: "Все категории" });
    expect(allCategories.getAttribute("aria-current")).toBe("true");
    fireEvent.click(allCategories);
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: "smooth", block: "start" });
    fireEvent.click(screen.getByRole("button", { name: "Перейти к категории Сказочные образы" }));
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: "smooth", block: "start" });
    expect(screen.getByRole("navigation", { name: "Быстрый переход по категориям" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Перейти к категории Интервью" }).querySelector("img")?.getAttribute("src")).toBe("/interview-girl.webp");
    expect(screen.getByRole("button", { name: "Перейти к категории Бойцовские и герои" }).querySelector("img")?.getAttribute("src")).toBe("/fighter-boy.webp");
    const dragonPreview = screen.getByLabelText("Беззвучное видео-превью: Полёт на драконе — ИИ-видео") as HTMLVideoElement;
    expect(dragonPreview.muted).toBe(true);
    expect(dragonPreview.autoplay).toBe(true);
    expect(dragonPreview.loop).toBe(true);
  });

  it("sends an individual request to the selected child's order card", async () => {
    vi.mocked(submitPublicCustomRequest).mockResolvedValue({
      duplicate: false, updated: false, order_number: "VS-CUSTOM", status: "new", total_amount: 0,
      selected_items: [{ id: "custom-request", name: "Индивидуальный запрос", price: 0, type: "custom", comment: "Образ пожарного" }],
      child_name: "Первый ребёнок", class_name: "1 А", public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    fireEvent.click(screen.getByRole("button", { name: /Не нашли нужный образ/ }));
    const dialog = screen.getByRole("dialog", { name: "Подобрать индивидуальный образ" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Образ пожарного" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Отправить запрос" }).closest("form")!);
    await waitFor(() => expect(submitPublicCustomRequest).toHaveBeenCalledWith(expect.objectContaining({ token: "test", childId: "first", message: "Образ пожарного" })));
    expect(await screen.findByText("Заявка сохранена")).toBeTruthy();
    expect(screen.getByText("Индивидуальный запрос")).toBeTruthy();
  });

  it("attaches a catalog service or a screenshot reference to an individual request", async () => {
    vi.mocked(submitPublicCustomRequest).mockResolvedValue({
      duplicate: false, updated: false, order_number: "VS-CUSTOM", status: "new", total_amount: 0,
      selected_items: [{ id: "custom-request", name: "Индивидуальный запрос", price: 0, type: "custom" }],
      child_name: "Первый ребёнок", class_name: "1 А", public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    fireEvent.click(screen.getByRole("button", { name: /Не нашли нужный образ/ }));
    const dialog = screen.getByRole("dialog", { name: "Подобрать индивидуальный образ" });
    expect(dialog.classList.contains("custom-request-modal")).toBe(true);
    const serviceCard = within(dialog).getByRole("radio", { name: /Первое фото/ });
    expect(serviceCard.querySelector("img")?.getAttribute("src")).toBe("/photo.webp");
    fireEvent.change(within(dialog).getByLabelText("Поиск услуги"), { target: { value: "не найдено" } });
    expect(within(dialog).getByText("Ничего не найдено. Попробуйте другое слово.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Поиск услуги"), { target: { value: "первое" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /Первое фото/ }));
    fireEvent.submit(within(dialog).getByRole("button", { name: "Отправить запрос" }).closest("form")!);
    await waitFor(() => expect(submitPublicCustomRequest).toHaveBeenCalledWith(expect.objectContaining({ catalogItemId: "photo" })));
    expect(await screen.findByText("Заявка сохранена")).toBeTruthy();
  });

  it("keeps multiple individual requests visible in the cart", async () => {
    vi.mocked(submitPublicCustomRequest).mockResolvedValue({
      duplicate: false, updated: true, order_number: "VS-CUSTOM", status: "new", total_amount: 0,
      selected_items: [
        { id: "custom-request-one", request_key: "one", name: "Индивидуальный запрос", price: 0, type: "custom", comment: "Мяч в руках", reference_service_name: "Футболист", preview_url: "/football.webp" },
        { id: "custom-request-two", request_key: "two", name: "Индивидуальный запрос", price: 0, type: "custom", comment: "Как на скрине", reference_path: "owner/screen.webp", reference_name: "screen.webp", preview_url: "/signed-screen.webp" },
      ],
      child_name: "Первый ребёнок", class_name: "1 А", public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    fireEvent.click(screen.getByRole("button", { name: /Не нашли нужный образ/ }));
    const dialog = screen.getByRole("dialog", { name: "Подобрать индивидуальный образ" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Как на скрине" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Отправить запрос" }).closest("form")!);
    fireEvent.click(await screen.findByRole("button", { name: /Назад к выбору/ }));
    fireEvent.click(screen.getByRole("button", { name: /Корзина/ }));
    const cart = screen.getByRole("dialog", { name: "Корзина" });
    expect(within(cart).getAllByText("Индивидуальный заказ")).toHaveLength(2);
    expect(within(cart).getByText("Мяч в руках")).toBeTruthy();
    expect(within(cart).getByText("Как на скрине")).toBeTruthy();
    expect(within(cart).getByText("Скрин прикреплён")).toBeTruthy();
    expect(within(cart).getByAltText("screen.webp").getAttribute("src")).toBe("/signed-screen.webp");
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
    fireEvent.click(screen.getByRole("button", { name: /Корзина.*1.*300/ }));
    expect(screen.getByRole("dialog", { name: "Корзина" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Оформить заявку" }));
    await waitFor(() => expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({ itemIds: ["photo"], withoutLaminationIds: ["photo"] })));
    expect(await screen.findByText("Прикреплена к карточке ребёнка")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
  });

  it("closes the cart sheet with a downward swipe from its content", async () => {
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    fireEvent.click(screen.getByRole("button", { name: "Добавить Первое фото в заказ" }));
    fireEvent.click(screen.getByRole("button", { name: /Корзина.*1.*350/ }));
    const cart = screen.getByRole("dialog", { name: "Корзина" });
    fireEvent.pointerDown(cart, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: 160, clientY: 120 });
    fireEvent.pointerMove(cart, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: 160, clientY: 230 });
    fireEvent.pointerUp(cart, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: 160, clientY: 230 });
    await waitFor(() => expect(cart.closest(".order-cart-layer")?.getAttribute("aria-hidden")).toBe("true"));
  });

  it("separates the 500 ruble photo animation from 800 ruble interview and 1200 ruble AI video", async () => {
    vi.mocked(submitPublicOrder).mockResolvedValueOnce({
      duplicate: false, updated: false, order_number: "VS-VIDEO", status: "new",
      selected_items: [{ id: "photo", name: "Первое фото", price: 850, type: "photo", video_addon_requested: true }],
      total_amount: 850, child_name: "Первый ребёнок", class_name: "1 А", public_token: "order-token",
    });
    render(<MemoryRouter initialEntries={["/p/test"]}><Routes><Route path="/p/:token" element={<PublicOrderPage />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Первый ребёнок/ }));
    fireEvent.click(screen.getByRole("button", { name: "Добавить Первое фото в заказ" }));
    fireEvent.click(screen.getByRole("button", { name: /Корзина.*1.*350/ }));
    fireEvent.click(screen.getByRole("button", { name: "Добавить пожелание" }));
    expect(screen.getByRole("dialog", { name: "Корзина", hidden: true }).closest(".order-cart-layer")?.getAttribute("aria-hidden")).toBe("true");
    const comment = screen.getByRole("textbox", { name: /Короткий комментарий/ });
    const animation = screen.getByRole("checkbox", { name: /Оживление фото.*500/ });
    expect(comment.compareDocumentPosition(animation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Интервью.*800 ₽.*ИИ.*видео.*1.*200 ₽/)).toBeTruthy();
    fireEvent.click(animation);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(screen.getByText("Оживление фото · +500 ₽")).toBeTruthy();
    expect(screen.getByText("850 ₽")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Корзина.*1.*850/ }));
    fireEvent.click(screen.getByRole("button", { name: "Оформить заявку" }));
    await waitFor(() => expect(submitPublicOrder).toHaveBeenCalledWith(expect.objectContaining({
      itemPreferences: { photo: { comment: "", videoAddonRequested: true } },
    })));
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
    const cartButton = screen.getByRole("button", { name: /Корзина.*1.*300/ });
    expect(cartButton.querySelector("img")?.getAttribute("src")).toBe("/photo.webp");
    expect(screen.getAllByRole("radio", { name: /Без защиты.*300/ }).find((item) => item.getAttribute("aria-checked") === "true")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Добавить Дополнительное фото в заказ" }));
    fireEvent.click(screen.getByRole("button", { name: /Корзина.*2.*650/ }));
    const cart = screen.getByRole("dialog", { name: "Корзина" });
    expect(within(cart).getByRole("img", { name: "Первое фото" }).getAttribute("src")).toBe("/photo.webp");
    expect(within(cart).getByText("Дополнительное фото")).toBeTruthy();
    fireEvent.click(within(cart).getByRole("button", { name: "Сохранить изменения" }));
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
    fireEvent.click(screen.getByRole("button", { name: /Корзина.*1.*350/ }));
    fireEvent.click(screen.getByRole("button", { name: "Убрать Первое фото из корзины" }));
    fireEvent.click(screen.getByRole("button", { name: "Нет, вернуть" }));
    expect(screen.getByRole("dialog", { name: "Корзина" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Убрать Первое фото из корзины" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Убрать Первое фото из корзины" }));
    fireEvent.click(screen.getByRole("button", { name: "Да, удалить" }));
    await waitFor(() => expect(cancelPublicOrder).toHaveBeenCalledWith({ token: "test", childId: "first" }));
    expect(await screen.findByText("Заявка удалена. Можно выбрать услуги заново.")).toBeTruthy();
    expect(screen.getByText("Пока без заявки")).toBeTruthy();
  });
});
