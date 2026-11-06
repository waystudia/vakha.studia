export const INTERVIEW_CATALOG_CATEGORY = "Фото с видео";

export const INTERVIEW_CATALOG_SERVICE_IDS = [
  "school-photo-interview-boy",
  "school-photo-interview-girl",
] as const;

const definitions = [
  {
    source_id: INTERVIEW_CATALOG_SERVICE_IDS[0],
    name: "Интервью ребёнка — мальчик",
    gender: "boys",
    preview: "boy-interview-desk.jpg",
    previewVideo: "schoolboy-interview-15s.mp4",
    description: "Портрет школьника за партой и персональное интервью с вопросами учителя за кадром.",
  },
  {
    source_id: INTERVIEW_CATALOG_SERVICE_IDS[1],
    name: "Интервью ребёнка — девочка",
    gender: "girls",
    preview: "girl-interview-desk.jpg",
    previewVideo: "",
    description: "Портрет школьницы за партой и персональное интервью с вопросами учителя за кадром.",
  },
] as const;

export function interviewCatalogServices(ownerId: string, publicBaseUrl: string) {
  const base = publicBaseUrl.endsWith("/") ? publicBaseUrl : `${publicBaseUrl}/`;
  return definitions.map((item, index) => {
    const previewUrl = new URL(`catalog-interviews/${item.preview}`, base).href;
    return {
      owner_id: ownerId,
      source_id: item.source_id,
      name: item.name,
      short_description: "Фото A4, ламинация, QR-оживление и интервью ребёнка.",
      description: item.description,
      type: "interview",
      category: INTERVIEW_CATALOG_CATEGORY,
      gender: item.gender,
      price: 800,
      preview_url: previewUrl,
      original_url: previewUrl,
      preview_video_url: item.previewVideo ? new URL(`catalog-interviews/${item.previewVideo}`, base).href : "",
      parent_preview_mode: "auto",
      is_active: true,
      sort_order: 540 + index,
      source: "system_interview_catalog",
    };
  });
}
