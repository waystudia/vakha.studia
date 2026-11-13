// Synthetic localhost-only API. Never proxies to CRM or Supabase.
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.env.VITE_CRM_MODE='true';
const token='demo-class-capability-12345678901234567890';
const roster=[];let attempts=0;
const server=await createServer({root,configFile:root+'vite.config.ts',server:{host:'127.0.0.1',port:5187,strictPort:true},plugins:[{name:'synthetic-parent-api',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith('/api/v1/public/'))return next();
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const path=req.url.slice('/api/v1/public/'.length);
 if(path==='classes/'+token&&req.method==='GET'){res.end(JSON.stringify({school:{name:'Тестовая школа (локально)',city:''},class:{id:'test-class',name:'Тестовый класс',academic_year:'2026',photo_session_name:'Проверка CRM-режима'},children:roster,catalog:[]}));return;}
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=raw?JSON.parse(raw):{};
 if(path.endsWith('/children/preview')){res.end(JSON.stringify({matches:roster}));return;}
 if(path.endsWith('/children')){attempts++;if(attempts===1){res.statusCode=503;res.end(JSON.stringify({error:'Тест: сервер временно недоступен'}));return;}
 const child={id:'test-child-stable-id',public_name:body.lastName+' '+body.firstName,orders:[]};if(!roster.length)roster.push(child);
 res.end(JSON.stringify({child,duplicate:attempts>2}));return;}
 res.statusCode=404;res.end(JSON.stringify({error:'Тестовый маршрут отсутствует'}));
 });}}]});await server.listen();console.log('Synthetic API only: http://127.0.0.1:5187/p/'+token);
