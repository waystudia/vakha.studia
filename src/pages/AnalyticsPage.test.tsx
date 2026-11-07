import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPage } from "./AnalyticsPage";
import { loadVisitAnalytics } from "../lib/repository";

vi.mock("../lib/repository", () => ({ loadVisitAnalytics: vi.fn() }));

beforeEach(() => {
  vi.mocked(loadVisitAnalytics).mockResolvedValue([
    { id: 1, owner_id: "owner", source_key: "class:1", page_kind: "class", school_id: "school", class_id: "class", visitor_hash: "a".repeat(64), open_count: 3, first_seen_at: "2026-11-07T10:00:00Z", last_seen_at: "2026-11-07T11:00:00Z", school: { name: "Школа 1", city: "Гелдаган" }, class: { name: "3в" } },
    { id: 2, owner_id: "owner", source_key: "catalog:owner", page_kind: "catalog", school_id: null, class_id: null, visitor_hash: "b".repeat(64), open_count: 1, first_seen_at: "2026-11-07T10:00:00Z", last_seen_at: "2026-11-07T10:00:00Z" },
  ]);
});

afterEach(() => cleanup());

describe("visit analytics", () => {
  it("groups class-link openings by the school's village without VPN geography", async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText("Гелдаган")).toBeTruthy();
    expect(screen.getByText("Всего открытий").parentElement?.textContent).toContain("4");
    expect(screen.getByText("Примерно посетителей").parentElement?.textContent).toContain("2");
    expect(screen.getByText(/VPN-страны и города не записываются/)).toBeTruthy();
    expect(screen.getByText("Школа 1 · 3в")).toBeTruthy();
  });
});
