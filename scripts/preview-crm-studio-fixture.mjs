// Local synthetic fixture only. No production API proxy, files, orders or persistent DB.
import {createServer} from 'vite';
import {fileURLToPath} from 'node:url';
process.env.VITE_CRM_MODE='true';
const root=fileURLToPath(new URL('../',import.meta.url));const schools=[],classes=[],children=[];let version=0;
const server=await createServer({root,configFile:root+'vite.config.ts',server:{host:'127.0.0.1',port:5189,strictPort:true},plugins:[{name:'synthetic-studio',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith('/api/v1/'))return next();res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 if(req.url==='/api/v1/me')return send({id:'synthetic-admin',login:'test',name:'Тест',role:'admin',active:true});
 if(req.url!=='/api/v1/studio/call')return send({error:'Только тестовый API'},404);
 let raw='';for await(const chunk of req)raw+=chunk;const {action,args,revisions}=JSON.parse(raw);const [one,two]=args;
 const school=id=>schools.find(s=>s.id===id);const group=id=>classes.find(c=>c.id===id);
 if(action==='loadSchools')return send(schools.map(s=>({...s,classes_count:classes.filter(c=>c.school_id===s.id).length,children_count:children.filter(k=>group(k.class_id)?.school_id===s.id).length,orders_count:0})));
 if(action==='createSchool'){const s={...one,id:'synthetic-school',crm_source_id:'synthetic-school',owner_id:'synthetic-admin',status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:++version};schools.push(s);return send(s);}
 if(action==='loadSchool')return send({school:school(one),classes:classes.filter(c=>c.school_id===one).map(c=>({...c,children_count:children.filter(k=>k.class_id===c.id).length,orders_count:0,missing_orders_count:children.filter(k=>k.class_id===c.id).length}))});
 if(action==='createClass'){if(revisions[one.school_id]!==school(one.school_id)?.revision)return send({error:'version_conflict'},409);const c={...one,id:'synthetic-class',crm_source_id:'synthetic-class',owner_id:'synthetic-admin',public_token:'synthetic-class-token-12345678901234567890',status:'active',revision:++version};classes.push(c);return send(c);}
 if(action==='loadClass')return send({schoolClass:group(one),school:school(group(one)?.school_id),children:children.filter(k=>k.class_id===one),orders:[]});
 if(action==='createChild'){if(revisions[one]!==group(one)?.revision)return send({error:'version_conflict'},409);const k={...two,id:'synthetic-child',class_id:one,public_name:two.last_name+' '+two.first_name,status:'active',revision:++version};children.push(k);return send(k);}
 return send({error:'Этот action не входит в синтетическую проверку'},501);
 });}}]});await server.listen();console.log('Synthetic staff fixture only: http://127.0.0.1:5189/admin/schools');
