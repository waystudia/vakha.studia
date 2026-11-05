import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParentIntro } from './ParentIntro';
import { hasWatchedParentIntro } from '../lib/parentIntroProgress';
afterEach(() => { localStorage.clear(); cleanup(); vi.restoreAllMocks(); });
it('attempts audible autoplay and offers one tap when the browser blocks it', async () => {
 vi.spyOn(HTMLMediaElement.prototype,'play').mockRejectedValue(new Error('NotAllowedError'));
 const complete=vi.fn();const {container}=render(<ParentIntro onComplete={complete}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:/Смотреть видео со звуком/})).toBeTruthy());
 expect(container.querySelector('video')!.muted).toBe(false);
 expect(container.querySelector('video')!.controls).toBe(true);
 expect(screen.queryByText(/Пропустить/)).toBeNull();
 fireEvent.click(document.body);
 expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
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
 expect(second.container.querySelector('video')!.autoplay).toBe(false);
 expect(screen.getByText('Видео просмотрено. Теперь можно выбрать фотографии.')).toBeTruthy();
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
