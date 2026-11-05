import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

export default defineConfig({
  define: { "import.meta.env.VITE_PARENT_INTRO_VERSION": JSON.stringify(createHash("sha256").update(readFileSync("public/media/khan-zama-intro.mp4")).digest("hex").slice(0, 16)) },
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), {
    name: "offline-catalog-shell",
    apply: "build",
    closeBundle() {
      const out = resolve("dist");
      const base = process.env.VITE_BASE_PATH || "/";
      const assets = readdirSync(resolve(out, "assets")).filter(name => /\.(js|css)$/.test(name)).map(name => `assets/${name}`);
      const files = ["index.html", "catalog.webmanifest", "pwa/icon-192.png", "pwa/icon-512.png", "pwa/apple-touch-icon.png", ...assets];
      const template = readFileSync("pwa/worker.js", "utf8");
      const hash = createHash("sha256").update(template).update(files.map(file => readFileSync(resolve(out, file))).reduce((all, next) => Buffer.concat([all, next]), Buffer.alloc(0))).digest("hex").slice(0, 16);
      writeFileSync(resolve(out, "sw.js"), template.replace("__SHELL_CACHE__", JSON.stringify(`vakha-catalog-shell-${Buffer.from(base).toString("hex")}-${hash}`)).replace("__PRECACHE__", JSON.stringify(files.map(file => base + file))));
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  test: {
    environment: "jsdom",
    maxWorkers: 2,
  },
});
