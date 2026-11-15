import type {PublicCatalogPayload} from './types';
/** Published CRM catalog only. Static snapshot is solely a compatibility fallback for an old API. */
export async function loadGeneralPublicCatalog():Promise<PublicCatalogPayload>{
 const live=await fetch('/api/v1/public/catalog',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
 let response=live;
 if(live.status===404||live.status===501)response=await fetch(`${import.meta.env.BASE_URL}catalog-snapshot/catalog.json`,{credentials:'omit',cache:'no-cache',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Каталог временно недоступен. Повторите загрузку.');
 const payload=await response.json();if(!Array.isArray(payload.catalog))throw new Error('Сервер вернул неполный каталог. Повторите загрузку.');
 return {company_name:'Khan Zama',watermark:{text:'Vakha Studio',image:'',opacity:.28},...payload};
}
