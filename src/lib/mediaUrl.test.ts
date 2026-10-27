import { describe, expect, it } from "vitest";
import { catalogMediaUrl } from "./mediaUrl";

describe("catalogMediaUrl", () => {
  it("добавляет версию к медиа, чтобы после замены файла не использовался старый кэш", () => {
    expect(catalogMediaUrl("https://example.test/video.mp4")).toBe("https://example.test/video.mp4?v=20261027");
    expect(catalogMediaUrl("https://example.test/video.mp4?download=1")).toBe("https://example.test/video.mp4?download=1&v=20261027");
  });
});
