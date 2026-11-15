/** Staff-only API. Never shares staff cookies with public client or opens CRM IndexedDB. */
const revisions = new Map<string, number>();
const requests = new Map<string, string>();
export class StudioApiError extends Error {
  constructor(message: string, readonly status: number) {super(message);}
}
function authChanged() {window.dispatchEvent(new Event('vakha-studio-auth'));}
async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {response=await fetch('/api/v1/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});}
  catch {throw new StudioApiError('Нет ответа CRM. Введённые данные остаются на экране. Проверьте интернет и повторите действие.',0);}
  let data:unknown;try{data=await response.json();}catch{throw new StudioApiError('CRM временно недоступна. Повторите действие.',response.status||502);}
  if(!response.ok){if(response.status===401&&path!=='me'&&path!=='login')authChanged();const value=data as {error?:string};throw new StudioApiError(response.status===409?'Данные изменились на другом устройстве. Обновите список и проверьте изменения перед повторной отправкой.':value?.error||'Не удалось выполнить действие в CRM',response.status);}
  return data as T;
}
function remember(value: unknown) {
  if(Array.isArray(value)) {value.forEach(remember);return;}
  if(!value||typeof value!=='object')return;
  const row=value as Record<string,unknown>;
  if(typeof row.id==='string'&&typeof row.revision==='number')revisions.set(row.id,row.revision);
  Object.values(row).forEach(remember);
}
function user(value: Record<string,unknown>) {
  return {...value,email:value.email||value.login,user_metadata:{full_name:value.full_name||value.name||value.login},app_metadata:{role:value.role}};
}
export async function crmStudioCall<T>(action: string, args: unknown[]): Promise<T> {
  if(action==='ensureDemoData')return undefined as T; // Never manufacture CRM records on login.
  if(action==='currentUser'){
    try{return user(await request<Record<string,unknown>>('me')) as T;}
    catch(error){if(error instanceof StudioApiError&&error.status===401)return null as T;throw error;}
  }
  if(action==='signIn') {const value=await request<Record<string,unknown>>('login',{login:args[0],password:args[1]});revisions.clear();requests.clear();authChanged();return {user:user(value)} as T;}
  if(action==='signOut') {await request('logout',{});revisions.clear();requests.clear();authChanged();return undefined as T;}
  if(action==='signUp')throw new Error('Учётные записи сотрудников создаёт администратор CRM.');
  if(action==='importCatalogItems') {
    const [userId,items,progress]=args as [string,Array<Record<string,unknown>>,(done:number,total:number)=>void];
    const form=new FormData();
    const metadata=items.map((item,index)=>Object.fromEntries(Object.entries(item).filter(([,value])=>!(value instanceof Blob)).concat(Object.entries(item).filter(([,value])=>value instanceof Blob).map(([key,value])=>{const field=`${index}_${key}`;form.append(field,value as Blob,field);return [key,field];}))));
    form.set('metadata',JSON.stringify({userId,items:metadata,requestKey:crypto.randomUUID()}));
    const response=await fetch('/api/v1/studio/import-catalog',{method:'POST',credentials:'same-origin',body:form});const result=await response.json();if(!response.ok)throw new StudioApiError(result.error||'Не удалось импортировать каталог',response.status);progress?.(items.length,items.length);return result as T;
  }
  const cleanArgs=args.map(value=>typeof value==='function'?null:value);
  const ids=new Set<string>();const collect=(value:unknown)=>{if(typeof value==='string'&&revisions.has(value))ids.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};cleanArgs.forEach(collect);
  const body={action,args:cleanArgs,revisions:Object.fromEntries([...ids].map(id=>[id,revisions.get(id)]))};
  const fingerprint=JSON.stringify(body);const requestKey=requests.get(fingerprint)||crypto.randomUUID();requests.set(fingerprint,requestKey);
  const result=await request<T>('studio/call',{...body,requestKey});requests.delete(fingerprint);remember(result);return result;
}
export async function importStudioProject(file: File, city: string, year: string) {
  const form=new FormData();form.set('file',file);form.set('city',city);form.set('year',year);form.set('requestKey',crypto.randomUUID());
  const response=await fetch('/api/v1/studio/import-project',{method:'POST',credentials:'same-origin',body:form});const data=await response.json();if(!response.ok)throw new StudioApiError(data.error||'Не удалось импортировать проект',response.status);return data;
}
export async function downloadStudioFile(path: string): Promise<Blob> {
  const response=await fetch('/api/v1/studio/file?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new StudioApiError('Не удалось получить файл CRM',response.status);return response.blob();
}
