# Catalog interface parity — 2026-11-15

Replaced the simplified CRM homepage catalog with the existing PublicCatalogPage.
Both deployments now use the same markup, CSS, service cards and media viewer:
intro video, shell/content widths, sticky gender/category filters, category
covers, popular section, service groups, lamination choice and selection dock.

CRM-only differences: snapshot data from /catalog-snapshot/catalog.json; checkout
requires the existing same-origin class capability link instead of creating a
Supabase public intake. Class links and CRM API remain unchanged. No staff admin
routes, school roster directory, or Supabase auth are exposed on the parent host.
The question about migrating the staff admin separately is pending user scope.

Supabase intake and offline controls are lazy modules, loaded only in their
original modes. The default Supabase build and intake test still pass. CRM tests
fail if the Supabase repository is loaded by the general CRM catalog.

Validation: 116 tests pass, default and CRM builds pass. Compared live legacy
public catalog against the new shared UI. At a 320px layout width: header
320x76/padding 0 20; heading 275x35/font32; sticky filters 285x86/padding6;
category covers 134x167 — identical on both sides. CRM explanatory text differs
because the order entry point differs. Device emulation only, no physical phone.

Deployment: static index/assets packaged over a copied current release; existing
79-service snapshot, catalog assets, intro MP4 and export ZIP retained. Previous
release remains available for rollback. No backend, DNS or actual order writes.
Source changes committed locally; no GitHub Pages/main push in this task.
