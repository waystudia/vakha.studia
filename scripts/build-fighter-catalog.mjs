import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import JSZip from "jszip";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const crmRoot = path.resolve(projectRoot, "../crm.photo");
const { CHILD_PORTRAIT_TEMPLATES, childPortraitCatalogRecord } = await import(
  pathToFileURL(path.join(crmRoot, "js/data/child-portrait-templates.js"))
);

const fighterIds = new Set([
  "child-boy-mma-tank",
  "child-boy-mma-shirt",
  "child-boy-boxing-tank",
  "child-boy-boxing-shirt",
]);
const services = CHILD_PORTRAIT_TEMPLATES
  .filter((item) => fighterIds.has(item.id))
  .map((item, index) => {
    const service = childPortraitCatalogRecord(item, index);
    const previewImage = `assets/${item.id}.webp`;
    const generationRequest = [
      "Запрос для создания образа:",
      service.prompt,
      "Используй приложенное изображение услуги как точный образец одежды, перчаток, надписей, композиции, света и фона. Замени только лицо на лицо ребёнка с загруженной фотографии; сохрани возраст, индивидуальные черты, форму лица, цвет кожи, глаза и естественную мимику. Не меняй надписи UFC, BOXING, Чемпион или Champion. Не добавляй логотипы, оружие, травмы или следы боя.",
    ].join("\n");
    return {
      ...service,
      previewImage,
      description: `${service.description}\n\n${generationRequest}`,
    };
  });

if (services.length !== fighterIds.size) {
  throw new Error(`Ожидалось ${fighterIds.size} услуги, найдено ${services.length}`);
}

const zip = new JSZip();
zip.file("catalog.json", `${JSON.stringify({
  title: "UFC и BOXING · Vakha Studio",
  exportedAt: new Date().toISOString(),
  services,
}, null, 2)}\n`);
for (const service of services) {
  zip.file(service.previewImage, await readFile(path.join(crmRoot, service.previewSrc)));
}

const outputDir = path.join(projectRoot, "public/catalog-updates");
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, "crm-fighters-20261105.zip");
await writeFile(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Собрано ${services.length} услуги: ${output}`);
