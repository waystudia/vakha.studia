// The fingerprint changes automatically when the introductory video is replaced.
export const parentIntroVersion = import.meta.env.VITE_PARENT_INTRO_VERSION || 'development';
const key = `vakha-parent-intro-complete:${import.meta.env.BASE_URL}:${parentIntroVersion}`;

export function hasWatchedParentIntro(): boolean {
  try { return localStorage.getItem(key) === 'complete'; }
  catch { return false; }
}

export function rememberParentIntro(): void {
  try { localStorage.setItem(key, 'complete'); }
  catch { /* The current page still unlocks when storage is unavailable. */ }
}
