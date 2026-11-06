export const INTERVIEW_CATALOG_CATEGORY = "Фото с видео";

export const INTERVIEW_CATALOG_SERVICE_IDS = [
  "school-photo-interview-boy",
  "school-photo-interview-girl",
] as const;

const definitions = [
  {
    source_id: INTERVIEW_CATALOG_SERVICE_IDS[0],
    name: "Интервью",
    gender: "boys",
    preview: "interview-boy-preview.jpg",
    original: "interview-boy-original.jpg",
    previewVideo: "interview-boy.mp4",
  },
  {
    source_id: INTERVIEW_CATALOG_SERVICE_IDS[1],
    name: "Интервью ребенка",
    gender: "girls",
    preview: "interview-girl-preview.jpg",
    original: "interview-girl-original.jpg",
    previewVideo: "interview-girl.mp4",
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
      short_description: "",
      description: "",
      type: "interview",
      category: INTERVIEW_CATALOG_CATEGORY,
      gender: item.gender,
      price: 800,
      preview_url: previewUrl,
      original_url: new URL(`catalog-interviews/${item.original}`, base).href,
      preview_video_url: item.previewVideo ? new URL(`catalog-interviews/${item.previewVideo}`, base).href : "",
      parent_preview_mode: "auto",
      is_active: true,
      sort_order: 540 + index,
      source: "system_interview_catalog",
    };
  });
}
