import {describe, expect, it} from "vitest";
import {buildCrmClassLinks} from "./crmClassLinks";

describe("CRM class links export", () => {
  it("exports only stable project/class identities and public links", () => {
    const payload = buildCrmClassLinks(
      {id:"local-school", crm_source_id:"crm-project", name:"Школа №1"} as never,
      [{id:"local-class", crm_source_id:"crm-class", name:"4А", public_token:"public token", children_count:25}] as never,
      "https://vakha.example"
    );
    expect(payload.links).toEqual([{projectId:"crm-project", classId:"crm-class", url:"https://vakha.example/?/p/public%20token", token:"public token"}]);
    expect(JSON.stringify(payload)).not.toContain("Школа №1");
    expect(JSON.stringify(payload)).not.toContain("children_count");
  });
});

it('exports a class link before any children are added', () => {
 const payload = buildCrmClassLinks({crm_source_id:'project'} as never, [{crm_source_id:'class', public_token:'token', children_count:0}] as never, 'https://vakha.example');
 expect(payload.links).toHaveLength(1);
 expect(payload.links[0].classId).toBe('class');
});
