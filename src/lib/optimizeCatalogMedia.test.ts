import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizeCatalogImage, optimizeCatalogVideo } from "./optimizeCatalogMedia";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("catalog import optimization", () => {
  it("resizes a large photo proportionally and releases the decoded bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 6000, close }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    let dimensions: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, callback) {
      dimensions = [this.width, this.height];
      callback(new Blob(["small"], { type: "image/webp" }));
    });
    const result = await optimizeCatalogImage(new Blob(["large original photo"], { type: "image/jpeg" }));
    expect(dimensions).toEqual([800, 1200]);
    expect(result.type).toBe("image/webp");
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps an already smaller photo rather than increasing its download size", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 200, height: 300, close: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["larger encoded result"], { type: "image/webp" })));
    const original = new Blob(["tiny"], { type: "image/jpeg" });
    expect(await optimizeCatalogImage(original)).toBe(original);
  });

  it("preserves video bytes when the browser cannot safely transcode audio", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const original = new Blob([new Uint8Array(4 * 1024 * 1024)], { type: "video/mp4" });
    expect(await optimizeCatalogVideo(original)).toBe(original);
  });
});
