import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";

const execFileAsync = promisify(execFile);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crmRoot = path.resolve(projectRoot, "../crm.photo");

const portraitsModule = await import(pathToFileURL(path.join(crmRoot, "js/data/child-portrait-templates.js")));
const videosModule = await import(pathToFileURL(path.join(crmRoot, "js/data/kindergarten-ai-video-services.js")));
const gamesModule = await import(pathToFileURL(path.join(crmRoot, "js/data/game-photo-services.js")));
const classPhotoModule = await import(pathToFileURL(path.join(crmRoot, "js/data/class-photo-service.js")));

const {
  CHILD_PORTRAIT_TEMPLATES,
  childPortraitCatalogRecord,
} = portraitsModule;
const { KINDERGARTEN_AI_VIDEO_SERVICES, SCHOOL_INTERVIEW_SERVICES } = videosModule;
const { GAME_PHOTO_SERVICES } = gamesModule;
const { CLASS_PHOTO_SERVICE } = classPhotoModule;

const childServices = CHILD_PORTRAIT_TEMPLATES
  .filter((item) => item.enabled)
  .map((item, index) => childPortraitCatalogRecord(item, index));
const services = [
  ...childServices,
  ...KINDERGARTEN_AI_VIDEO_SERVICES,
  ...SCHOOL_INTERVIEW_SERVICES,
  CLASS_PHOTO_SERVICE,
  ...GAME_PHOTO_SERVICES,
];

const zip = new JSZip();
const includedFiles = new Set();
const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "vakha-catalog-"));

function cleanAssetPath(value) {
  return String(value || "").trim().replace(/^\.\//, "");
}

async function includeAsset(value) {
  const relativePath = cleanAssetPath(value);
  if (!relativePath || includedFiles.has(relativePath)) return relativePath;
  const absolutePath = path.resolve(crmRoot, relativePath);
  if (!absolutePath.startsWith(`${crmRoot}${path.sep}`)) throw new Error(`Небезопасный путь: ${relativePath}`);
  let assetPath = absolutePath;
  if (path.extname(relativePath).toLowerCase() === ".mp4") {
    assetPath = path.join(temporaryDir, `${includedFiles.size}-${path.basename(relativePath)}`);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", absolutePath,
      "-vf", "scale=720:-2:force_original_aspect_ratio=decrease",
      "-c:v", "libx264", "-preset", "medium", "-crf", "28", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", assetPath,
    ]);
  }
  zip.file(relativePath, await readFile(assetPath));
  includedFiles.add(relativePath);
  return relativePath;
}

const exportedServices = [];
for (const service of services) {
  const previewImage = await includeAsset(service.previewSrc);
  const previewVideo = await includeAsset(service.previewVideoUrl || service.previewVideoSrc);
  exportedServices.push({
    ...service,
    ...(previewImage ? { previewImage } : {}),
    ...(previewVideo ? { previewVideo } : {}),
    presentation: { parentPreviewMode: service.parentPreviewMode || "auto" },
  });
}

zip.file("catalog.json", `${JSON.stringify({
  title: "Полный каталог услуг CRM Photo",
  exportedAt: new Date().toISOString(),
  services: exportedServices,
}, null, 2)}\n`);

const outputDir = path.join(projectRoot, "public/catalog-updates");
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, "crm-20261108.zip");
await writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
await rm(temporaryDir, { recursive: true, force: true });

const categories = Object.fromEntries(
  Object.entries(Object.groupBy(exportedServices, (item) => item.category || "Без категории"))
    .map(([category, items]) => [category, items.length]),
);
console.log(JSON.stringify({ output, services: exportedServices.length, categories }, null, 2));
