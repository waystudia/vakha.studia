import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { CatalogViewer, viewerItems, type ViewerItem } from "./CatalogViewer";

const items: ViewerItem[] = [
  { id: "boy", name: "Мальчик", category: "Фото", gender: "boys", type: "photo", price: 350, preview_url: "/boy.jpg", preview_video_url: "" },
  { id: "girl", name: "Девочка", category: "ИИ-видео", gender: "girls", type: "video", price: 1200, preview_url: "/girl.jpg", preview_video_url: "/girl.mp4" },
  { id: "class", name: "Общее фото класса", category: "Фото", gender: "unisex", type: "photo", price: 350, preview_url: "/class.jpg", preview_video_url: "", parent_preview_mode: "print" },
];

function Journey() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  return <><output>{location.pathname}{location.search}{location.hash}</output><output aria-label="Выбранные услуги">{selected.join(",")}</output>
    <input aria-label="Фильтр исходного каталога" defaultValue="Фото" />
    <button onClick={() => setOpen(true)}>Открыть фото</button><button onClick={() => navigate(-1)}>Назад браузера</button>
    {open && <CatalogViewer items={items} initialId="class" initialGender="all" initialCategory="Фото" selected={selected}
      onToggle={id => setSelected(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id])} onClose={() => setOpen(false)} />}</>;
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) { return this.dataset.itemId === "class" ? 2000 : 0; });
});
afterEach(async () => { cleanup(); await new Promise(resolve => requestAnimationFrame(() => resolve(null))); vi.restoreAllMocks(); });

describe("fullscreen catalog journey", () => {
  it("keeps the installed offline catalog strictly for viewing", async () => {
    const toggle = vi.fn();
    render(<MemoryRouter><CatalogViewer immersive readOnly items={items} initialId="class" selected={[]} onToggle={toggle} onClose={() => {}} /></MemoryRouter>);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Добавить к заказу" })).toBeNull();
    expect(toggle).not.toHaveBeenCalled();
  });
  it("turns a selected service into a direct checkout action for parents", async () => {
    const toggle = vi.fn();
    const checkout = vi.fn();
    render(<MemoryRouter><CatalogViewer items={items} initialId="boy" selected={["boy"]} onToggle={toggle} onCheckout={checkout} onClose={() => {}} /></MemoryRouter>);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Оформить заказ" }));
    expect(checkout).toHaveBeenCalledOnce();
    expect(toggle).not.toHaveBeenCalled();
  });
  it("lets the general catalog hide filters over a full-screen photo and fit the entire image", async () => {
    render(<MemoryRouter><CatalogViewer immersive items={items} initialId="class" selected={[]} onToggle={() => {}} onClose={() => {}} /></MemoryRouter>);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.classList.contains("service-gallery-presentation")).toBe(true);
    expect(within(dialog).queryByRole("group", { name: "Категория услуги" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Фильтры" }));
    expect(within(dialog).getByRole("group", { name: "Категория услуги" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Фильтры" }));
    expect(within(dialog).queryByRole("group", { name: "Категория услуги" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Фото целиком" }));
    expect(dialog.classList.contains("is-fitted")).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Заполнить экран" })).toBeTruthy();
  });
  it("filters by gender/category without duplicating unisex services", () => {
    expect(viewerItems(items, "boys", "Фото").map(item => item.id)).toEqual(["boy", "class"]);
    expect(viewerItems(items, "girls", "ИИ-видео").map(item => item.id)).toEqual(["girl"]);
    expect(viewerItems(items, "girls", "all").map(item => item.id)).toEqual(["girl", "class", "boy"]);
  });
  it("opens interview artwork inside a stable horizontal frame", async () => {
    const interview = { ...items[0], id: "interview", name: "Интервью", category: "Фото с видео", type: "interview", original_url: "/interview-horizontal.jpg" };
    render(<MemoryRouter><CatalogViewer items={[interview]} initialId="interview" selected={[]} onToggle={() => {}} onClose={() => {}} /></MemoryRouter>);
    const service = await screen.findByRole("article", { name: interview.name });
    const media = service.querySelector(".service-gallery-photo");
    expect(media?.classList.contains("is-landscape")).toBe(true);
    expect(within(service).getByRole("img", { name: interview.name }).getAttribute("src")).toBe("/interview-horizontal.jpg");
  });
  it.each(["Закрыть просмотр", "Назад браузера"])("%s restores the same filtered origin, scroll and selection in StrictMode", async close => {
    Object.defineProperty(window, "scrollY", { value: 642, configurable: true });
    render(<StrictMode><MemoryRouter initialEntries={["/catalog/test?from=class#photos"]}><Journey /></MemoryRouter></StrictMode>);
    const source = screen.getByRole("button", { name: "Открыть фото" });
    source.focus(); fireEvent.click(source);
    const dialog = await screen.findByRole("dialog", { name: "Просмотр услуг" });
    expect(document.body.style.position).toBe("fixed");
    expect(dialog.classList.contains("service-gallery-presentation")).toBe(false);
    expect(dialog.querySelector(".service-gallery-scroll")?.scrollTop).toBe(2000);
    fireEvent.click(within(dialog).getByRole("article", { name: "Общее фото класса" }).querySelector("button")!);
    expect(screen.getByLabelText("Выбранные услуги").textContent).toBe("class");
    fireEvent.click(screen.getByRole("button", { name: close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("textbox").getAttribute("value")).toBe("Фото");
    expect(screen.getByText("/catalog/test?from=class#photos")).toBeTruthy();
    expect(screen.getByLabelText("Выбранные услуги").textContent).toBe("class");
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 642);
    expect(document.activeElement).toBe(source);
    expect(document.body.style.position).toBe("");
  });
  it("changes filters inside the viewer, handles empty results, and never adds QR/video to the class photo", async () => {
    render(<MemoryRouter><Journey /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Открыть фото" }));
    const dialog = await screen.findByRole("dialog");
    const group = within(dialog).getByRole("article", { name: "Общее фото класса" });
    expect(group.querySelector("video")).toBeNull();
    expect(group.textContent).not.toContain("QR");
    fireEvent.click(within(dialog).getByRole("button", { name: "Фильтры" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "ИИ-видео" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Мальчикам" }));
    expect(within(dialog).getByRole("article", { name: "Девочка" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Все категории" }));
    expect(within(dialog).getAllByRole("article")).toHaveLength(3);
  });
  it("offers photo retry without removing the video player", async () => {
    render(<MemoryRouter><CatalogViewer items={items} initialId="girl" selected={[]} onToggle={() => {}} onClose={() => {}} /></MemoryRouter>);
    const service = await screen.findByRole("article", { name: "Девочка" });
    fireEvent.error(within(service).getByRole("img", { name: "Девочка" }));
    expect(within(service).getByRole("alert")).toBeTruthy();
    expect(service.querySelector("video")).not.toBeNull();
    expect(service.querySelector("video")?.autoplay).toBe(true);
    expect(service.querySelector("video")?.muted).toBe(true);
    expect(service.querySelector("video")?.controls).toBe(false);
    expect(within(service).queryByRole("button", { name: /Развернуть видео/ })).toBeNull();
    const fullscreen = within(service).getByRole("button", { name: /на весь экран/ });
    fireEvent.click(fullscreen);
    expect(service.querySelector("video")?.muted).toBe(false);
    fireEvent.click(within(service).getByRole("button", { name: "Повторить загрузку фото" }));
    expect(within(service).getByRole("img", { name: "Девочка" })).toBeTruthy();
  });
});
