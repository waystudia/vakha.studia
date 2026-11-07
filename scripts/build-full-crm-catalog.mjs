import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";

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

function cleanAssetPath(value) {
  return String(value || "").trim().replace(/^\.\//, "");
}

async function includeAsset(value) {
  const relativePath = cleanAssetPath(value);
  if (!relativePath || includedFiles.has(relativePath)) return relativePath;
  const absolutePath = path.resolve(crmRoot, relativePath);
  if (!absolutePath.startsWith(`${crmRoot}${path.sep}`)) throw new Error(`Небезопасный путь: ${relativePath}`);
  zip.file(relativePath, await readFile(absolutePath));
  includedFiles.add(relativePath);
  return relativePath;
}

const exportedServices = [];
for (const service of services) {
  const previewImage = await includeAsset(service.previewSrc);
  const previewVideo = await includeAsset(service.previewVideoUrl || service.previewVideoSrc);
  const originalImage = service.gamePhotoService ? await includeAsset(service.originalSrc) : "";
  exportedServices.push({
    ...service,
    ...(previewImage ? { previewImage } : {}),
    ...(originalImage ? { originalImage } : {}),
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

const categories = Object.fromEntries(
  Object.entries(Object.groupBy(exportedServices, (item) => item.category || "Без категории"))
    .map(([category, items]) => [category, items.length]),
);
console.log(JSON.stringify({ output, services: exportedServices.length, categories }, null, 2));
