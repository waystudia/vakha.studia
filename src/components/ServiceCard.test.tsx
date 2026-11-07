import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceCard } from "./ServiceCard";

describe("interview service card", () => {
  it("uses the portrait card treatment for the exact CRM girl interview", () => {
    render(<ServiceCard item={{
      id: "girl-interview",
      name: "Интервью ребенка",
      description: "",
      short_description: "",
      type: "interview",
      category: "Фото с видео",
      gender: "girls",
      price: 800,
      preview_url: "/girl.jpg",
      preview_video_url: "/girl.mp4",
      parent_preview_mode: "auto",
    }} selected={false} onOpen={() => {}} onToggle={() => {}} />);
    const card = screen.getByRole("button", { name: "Смотреть услугу: Интервью ребенка" });
    expect(card.classList.contains("catalog-interview-card")).toBe(true);
    expect(card.querySelector("img")?.getAttribute("src")).toBe("/girl.jpg");
    const details = screen.getByRole("button", { name: "Что вы получите?" });
    expect(details.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("QR-оживление")).toBeNull();
    fireEvent.click(details);
    expect(details.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("QR-оживление")).toBeTruthy();
    expect(screen.getByText("Интервью ребёнка")).toBeTruthy();
  });
});
