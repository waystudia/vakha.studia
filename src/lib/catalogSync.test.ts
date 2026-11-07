import { describe, expect, it } from "vitest";
import { activeCatalogItemIdsOutsideCrm } from "./catalogSync";

describe("activeCatalogItemIdsOutsideCrm", () => {
  it("keeps CRM services and only returns active services absent from the import", () => {
    expect(activeCatalogItemIdsOutsideCrm([
      { id: "keep", source_id: "crm-photo", is_active: true },
      { id: "remove", source_id: "local-extra", is_active: true },
      { id: "already-hidden", source_id: "old-extra", is_active: false },
    ], [{ sourceId: "crm-photo" }])).toEqual(["remove"]);
  });
});
