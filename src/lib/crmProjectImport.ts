import JSZip from 'jszip';
export type CrmRecord = Record<string, any>;
export interface CrmProjectDraft { projects: CrmRecord[]; classes: CrmRecord[]; students: CrmRecord[]; services: CrmRecord[]; orders: CrmRecord[]; mediaCount: number; }
export function validateCrmProject(data: CrmRecord): CrmProjectDraft {
  const list = (key: string): CrmRecord[] => {
    const rows = data[key] ?? [];
    if (!Array.isArray(rows) || rows.length > 20000) throw new Error(`Некорректный список ${key}`);
    const ids=new Set<string>();
    for(const row of rows){if(!row || typeof row.id!=='string' || !row.id || ids.has(row.id))throw new Error(`Повторяющийся или пустой ID: ${key}`);ids.add(row.id);}
    return rows;
  };
  const projects=list('projects'), classes=list('classes'), students=list('students'), services=list('services'), orders=list('orders');
  if(!projects.length)throw new Error('В ZIP нет проектов. Выберите экспорт проекта или всех данных CRM.');
  const projectsById=new Set(projects.map(p=>p.id)), classesById=new Set(classes.map(c=>c.id)), studentsById=new Set(students.map(s=>s.id));
  for(const c of classes)if(!projectsById.has(c.projectId))throw new Error(`Класс «${c.name}» не связан со школой в архиве`);
  for(const s of students){
    if(!classesById.has(s.classId))throw new Error('В архиве есть ребёнок без класса');
    if(!String(s.firstName||'').trim() || !String(s.lastName||'').trim())throw new Error('У каждого ребёнка должны быть имя и фамилия. Исправьте список в CRM.');
  }
  for(const o of orders)if(!studentsById.has(o.studentId))throw new Error('В архиве есть заказ без ребёнка');
  return {projects,classes,students,services,orders,mediaCount:['media','finalWorks','documents'].reduce((n,k)=>n+(Array.isArray(data[k])?data[k].length:0),0)};
}
export async function parseCrmProjectZip(file: File): Promise<CrmProjectDraft> {
  if(file.size>50*1024*1024)throw new Error('Для импорта проекта ZIP должен быть не больше 50 МБ. Экспортируйте проект без встроенных шаблонов.');
  const zip=await JSZip.loadAsync(file);
  const manifest=zip.file('manifest.json'), entry=zip.file('data.json');
  if(!manifest || !entry)throw new Error('Нужен ZIP проекта CRM с manifest.json и data.json');
  const info=JSON.parse(await manifest.async('string'));
  if(!['Vakha Studio','School Photo Flow'].includes(info.app) || info.schemaVersion!==1)throw new Error('Формат или версия архива не поддерживаются');
  const json=await entry.async('string');
  if(json.length>30*1024*1024)throw new Error('Список данных слишком большой для одного импорта');
  return validateCrmProject(JSON.parse(json));
}
