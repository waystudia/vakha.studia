import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParentIntro } from './ParentIntro';
import { hasWatchedParentIntro } from '../lib/parentIntroProgress';
afterEach(() => { localStorage.clear(); cleanup(); vi.restoreAllMocks(); });
it('attempts audible autoplay and offers one tap when the browser blocks it', async () => {
 vi.spyOn(HTMLMediaElement.prototype,'play').mockRejectedValue(new Error('NotAllowedError'));
 const complete=vi.fn();const {container}=render(<ParentIntro onComplete={complete}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:/Посмотреть видео/})).toBeTruthy());
 expect(container.querySelector('video')!.muted).toBe(false);
 expect(container.querySelector('video')!.controls).toBe(true);
 expect(screen.queryByText(/Пропустить/)).toBeNull();
 fireEvent.click(document.body);
 await waitFor(()=>expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2));
 expect(complete).not.toHaveBeenCalled();
 expect(hasWatchedParentIntro()).toBe(false);
 fireEvent.error(container.querySelector('video')!);
 expect(complete).not.toHaveBeenCalled();
});
it('unlocks only after continuous playback, allows rewinding and blocks skipping forward', () => {
 vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 const complete=vi.fn();const {container}=render(<ParentIntro onComplete={complete}/>);const video=container.querySelector('video')!;
 Object.defineProperty(video,'duration',{value:12,configurable:true});
 video.currentTime=11;fireEvent.seeking(video);expect(video.currentTime).toBe(0);
 fireEvent.ended(video);expect(complete).not.toHaveBeenCalled();
 for(let t=1;t<=6;t++){video.currentTime=t;fireEvent.timeUpdate(video);}
 video.currentTime=3;fireEvent.seeking(video);expect(video.currentTime).toBe(3);
 for(let t=4;t<=12;t++){video.currentTime=t;fireEvent.timeUpdate(video);}
 fireEvent.ended(video);expect(complete).toHaveBeenCalledTimes(1);
 fireEvent.ended(video);expect(complete).toHaveBeenCalledTimes(1);
 expect(hasWatchedParentIntro()).toBe(true);
});

it('restores a completed viewing without forcing autoplay again', () => {
 const play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 const complete=vi.fn();
 const first=render(<ParentIntro onComplete={complete}/>);const video=first.container.querySelector('video')!;
 Object.defineProperty(video,'duration',{value:3,configurable:true});
 for(let t=1;t<=3;t++){video.currentTime=t;fireEvent.timeUpdate(video);}
 fireEvent.ended(video);first.unmount();
 expect(hasWatchedParentIntro()).toBe(true);
 play.mockClear();
 const second=render(<ParentIntro watched={hasWatchedParentIntro()} onComplete={vi.fn()}/>);
 expect(play).not.toHaveBeenCalled();
 expect(second.container.querySelector('video')).toBeNull();
 expect(screen.getByText('Видео просмотрено')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Посмотреть ещё раз'}));
 expect(second.container.querySelector('video')!.autoplay).toBe(false);
 expect(second.container.querySelector('video')!.poster).toContain('khan-zama-intro-poster.webp');
 expect(play).toHaveBeenCalledTimes(1);
});

it('shows the catalog shortcut only before the catalog reaches the viewport', async () => {
 const target=document.createElement('div');target.id='public-catalog-start';document.body.appendChild(target);
 let targetTop=900;vi.spyOn(target,'getBoundingClientRect').mockImplementation(()=>({top:targetTop,bottom:targetTop+100,left:0,right:100,width:100,height:100,x:0,y:targetTop,toJSON:()=>({})}));
 const scrollIntoView=vi.fn();Object.defineProperty(target,'scrollIntoView',{value:scrollIntoView,configurable:true});
 render(<ParentIntro watched onComplete={vi.fn()}/>);
 const shortcut=await screen.findByRole('button',{name:/Наш каталог/});fireEvent.click(shortcut);
 expect(scrollIntoView).toHaveBeenCalledWith({behavior:'smooth',block:'start'});
 targetTop=200;fireEvent.scroll(window);
 await waitFor(()=>expect(screen.queryByRole('button',{name:/Наш каталог/})).toBeNull());
 target.remove();
});

it('counts natural playback even when the browser throttles timeupdate events', () => {
 vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
 const complete=vi.fn();const {container}=render(<ParentIntro onComplete={complete}/>);const video=container.querySelector('video')!;
 Object.defineProperty(video,'duration',{value:56,configurable:true});
 for(const time of [1,9,29,56]) {video.currentTime=time;fireEvent.timeUpdate(video);}
 fireEvent.ended(video);
 expect(complete).toHaveBeenCalledTimes(1);
 expect(hasWatchedParentIntro()).toBe(true);
});
