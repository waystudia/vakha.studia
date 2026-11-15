import { PublicCatalogPage } from './PublicCatalogPage';

/** Share the exact legacy catalog UI; only its data source and order entry differ. */
export function CrmCatalogPage() {
  return <PublicCatalogPage crmSnapshot/>;
}
