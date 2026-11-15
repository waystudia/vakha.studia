import {downloadStudioFile,crmStudioCall} from './crmStudioRepository';
export async function downloadPrivateFile(path: string, bucket='parent-request-references'): Promise<Blob> {
 if(import.meta.env.VITE_CRM_MODE==='true')return downloadStudioFile(path);
 const {supabase}=await import('./supabase');const {data,error}=await supabase.storage.from(bucket).download(path);if(error||!data)throw error||new Error('Файл не найден');return data;
}
export async function privateMediaUrls(paths:string[]):Promise<Record<string,string>> {
 if(import.meta.env.VITE_CRM_MODE==='true')return crmStudioCall('getPrivateMediaUrls',[paths]);
 const {supabase}=await import('./supabase');const entries=await Promise.all(paths.map(async path=>{const {data,error}=await supabase.storage.from('parent-request-references').createSignedUrl(path,3600);return [path,error?'':data?.signedUrl||''];}));return Object.fromEntries(entries.filter(([,url])=>url));
}
