import { afterEach, expect, it, vi } from 'vitest';
import { hasWatchedParentIntro, rememberParentIntro } from './parentIntroProgress';
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});
it('persists completion across reads and ignores another video version',()=>{
 localStorage.setItem(`vakha-parent-intro-complete:${import.meta.env.BASE_URL}:old-video`, 'complete');
 expect(hasWatchedParentIntro()).toBe(false);
 rememberParentIntro();
 expect(hasWatchedParentIntro()).toBe(true);
});
it('does not break the page when browser storage is unavailable',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked');});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 expect(hasWatchedParentIntro()).toBe(false);
 expect(()=>rememberParentIntro()).not.toThrow();
});
