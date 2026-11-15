import {useEffect,useRef} from 'react';
/** Refresh shared CRM records without replacing an open form or touching offline stores. */
export function useStudioRefresh(refresh:()=>Promise<unknown>,paused=false){
 const callback=useRef(refresh);callback.current=refresh;const pause=useRef(paused);pause.current=paused;
 useEffect(()=>{
  if(import.meta.env.VITE_CRM_MODE!=='true')return;
  let busy=false,alive=true;
  async function update(){if(!alive||busy||pause.current||document.hidden||!navigator.onLine||document.querySelector('[role="dialog"]')||document.activeElement?.matches('input,textarea,select'))return;busy=true;try{await callback.current();}catch{/* Existing rows stay visible during network failure. */}finally{busy=false;}}
  const timer=window.setInterval(()=>void update(),20000);const focus=()=>void update();window.addEventListener('focus',focus);window.addEventListener('online',focus);
  return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('online',focus);};
 },[]);
}
