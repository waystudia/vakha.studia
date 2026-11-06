import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ServiceCard } from "./ServiceCard";

describe("interview service card", () => {
  it("uses the portrait card treatment and names the deliverable even before a girl video preview is uploaded", () => {
    render(<ServiceCard item={{
      id: "girl-interview",
      name: "Интервью ребёнка — девочка",
      description: "",
      short_description: "",
      type: "interview",
      category: "Фото с видео",
      gender: "girls",
      price: 800,
      preview_url: "/girl.jpg",
      preview_video_url: "",
      parent_preview_mode: "auto",
    }} selected={false} onOpen={() => {}} onToggle={() => {}} />);
    const card = screen.getByRole("button", { name: "Смотреть услугу: Интервью ребёнка — девочка" });
    expect(card.classList.contains("catalog-interview-card")).toBe(true);
    expect(screen.getByText("Интервью ребёнка")).toBeTruthy();
    expect(card.querySelector("video")).toBeNull();
  });
});
