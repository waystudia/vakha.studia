import { describe, expect, it } from "vitest";
import { activeCatalogItemIdsOutsideCrm } from "./catalogSync";

describe("activeCatalogItemIdsOutsideCrm", () => {
  it("keeps imported and system services and only returns active CRM extras", () => {
    expect(activeCatalogItemIdsOutsideCrm([
      { id: "keep", source_id: "crm-photo", is_active: true, source: "crm_photo_zip" },
      { id: "system", source_id: "interview-girl", is_active: true, source: "system_interview_catalog" },
      { id: "remove", source_id: "local-extra", is_active: true, source: "crm_photo_zip" },
      { id: "already-hidden", source_id: "old-extra", is_active: false, source: "crm_photo_zip" },
    ], [{ sourceId: "crm-photo" }])).toEqual(["remove"]);
  });
});
