// Build an independent read-only public snapshot from the verified legacy backup.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import JSZip from 'jszip';
const [archive,output]=process.argv.slice(2);
if(!archive||!output)throw new Error('Usage: node scripts/prepare-legacy-catalog-snapshot.mjs backup.zip dist/catalog-snapshot');
const zip=await JSZip.loadAsync(await readFile(archive));
const read=async name=>JSON.parse(await zip.file(name).async('string'));
const summary=await read('summary.json');if(summary.errors.length||summary.downloaded!==summary.assets)throw new Error('Backup incomplete');
const rows=await read('catalog-source.json'),manifest=await read('assets-manifest.json');
const used=new Map();
function asset(url){if(!url)return '';const info=manifest[url];if(!info?.path||!/^assets\/[a-f0-9]+\.[a-zA-Z0-9]+$/.test(info.path))throw new Error('Invalid asset path');used.set(info.path,info);return '/catalog-snapshot/'+info.path;}
const catalog=rows.filter(row=>row.is_active).map(row=>({id:row.source_id||row.id,name:row.name,description:row.description,short_description:row.short_description,type:row.type,category:row.category,gender:row.gender,price:Number(row.price),popular:row.popular,parent_preview_mode:row.parent_preview_mode,preview_url:asset(row.preview_url),original_url:asset(row.original_url),preview_video_url:asset(row.preview_video_url)}));
if(new Set(catalog.map(row=>row.id)).size!==catalog.length)throw new Error('Duplicate service IDs');
await mkdir(path.join(output,'assets'),{recursive:true});
for(const [name,info]of used){const data=await zip.file(name).async('nodebuffer');if(data.length!==info.bytes||createHash('sha256').update(data).digest('hex')!==info.sha256)throw new Error('Asset checksum mismatch: '+name);await writeFile(path.join(output,name),data);}
await writeFile(path.join(output,'catalog.json'),JSON.stringify({catalog},null,2));
console.log(JSON.stringify({services:catalog.length,assets:used.size,output}));
