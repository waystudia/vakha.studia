import {lazy,Suspense,useEffect,useState} from 'react';
import {Navigate,Route,Routes} from 'react-router-dom';
import type {User} from '@supabase/supabase-js';
import {currentUser} from './lib/repository';
import {AdminLayout} from './components/AdminLayout';
import {Loader,Notice} from './components/ui';
import {LoginPage} from './pages/LoginPage';
import {humanError} from './lib/helpers';
const Schools=lazy(()=>import('./pages/SchoolsPage').then(m=>({default:m.SchoolsPage})));
const School=lazy(()=>import('./pages/SchoolPage').then(m=>({default:m.SchoolPage})));
const Class=lazy(()=>import('./pages/ClassPage').then(m=>({default:m.ClassPage})));
const Catalog=lazy(()=>import('./pages/CatalogPage').then(m=>({default:m.CatalogPage})));
const Orders=lazy(()=>import('./pages/OrdersPage').then(m=>({default:m.OrdersPage})));
const Analytics=lazy(()=>import('./pages/AnalyticsPage').then(m=>({default:m.AnalyticsPage})));
const Inquiries=lazy(()=>import('./pages/InquiriesPage').then(m=>({default:m.InquiriesPage})));
const Profile=lazy(()=>import('./pages/ProfilePage').then(m=>({default:m.ProfilePage})));
const CatalogView=lazy(()=>import('./pages/AdminCatalogViewPage').then(m=>({default:m.AdminCatalogViewPage})));
export default function CrmAdminApp(){
 const [actor,setActor]=useState<User|null>(null),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let alive=true;async function load(){try{const value=await currentUser();if(alive){setActor(value);setError('');}}catch(reason){if(alive)setError(humanError(reason));}finally{if(alive)setReady(true);}}void load();window.addEventListener('vakha-studio-auth',load);return()=>{alive=false;window.removeEventListener('vakha-studio-auth',load);};},[]);
 if(!ready)return <Loader label="Проверяем вход…"/>;
 if(error)return <main className="page"><Notice kind="error">{error}</Notice><button className="button button-secondary" onClick={()=>window.location.reload()}>Повторить загрузку</button></main>;
 const allowed=actor&&['admin','manager'].includes(String((actor as User&{role?:string}).role||actor.app_metadata.role));
 const guard=!actor?<Navigate to="/login" replace/>:!allowed?<Notice kind="error">Этот раздел доступен администратору или менеджеру CRM.</Notice>:<AdminLayout/>;
 return <Suspense fallback={<Loader label="Открываем раздел…"/>}><Routes>
 <Route path="/login" element={<LoginPage session={actor?{user:{id:actor.id}}:null}/>}/>
 <Route path="/admin" element={guard}>
 <Route index element={<Navigate to="schools" replace/>}/><Route path="schools" element={<Schools/>}/><Route path="schools/:schoolId" element={<School/>}/><Route path="classes/:classId" element={<Class/>}/>
 <Route path="catalog" element={<Catalog userId={actor?.id||''}/>}/><Route path="orders" element={<Orders/>}/><Route path="analytics" element={<Analytics/>}/><Route path="inquiries" element={<Inquiries/>}/><Route path="profile" element={<Profile userId={actor?.id||''}/>}/>
 <Route path="public-catalog" element={<CatalogView userId={actor?.id||''}/>}/><Route path="presentation" element={<CatalogView userId={actor?.id||''} presentation/>}/>
 </Route></Routes></Suspense>;
}
