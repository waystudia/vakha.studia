import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import './ParentIntro.css';
import { parentIntroVersion, rememberParentIntro } from '../lib/parentIntroProgress';

export function ParentIntro({onComplete, watched = false}: {onComplete: () => void; watched?: boolean}) {
  const video = useRef<HTMLVideoElement>(null);
  const furthest = useRef(0);
  const completed = useRef(watched);
  const [blocked, setBlocked] = useState(watched);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(watched);
  useEffect(() => {
    const player = video.current;
    if (!player || watched) return;
    player.muted = false;
    void player.play().catch(() => setBlocked(true));
  }, [watched]);
  useEffect(() => {
    if (!blocked || failed) return;
    const retryOnTouch = (event: MouseEvent) => {
      // Native video controls keep their own play/pause and volume behavior.
      if (event.target instanceof Element && event.target.closest('video')) return;
      const player = video.current;
      if (!player) return;
      player.muted = false;
      void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
    };
    document.addEventListener('click', retryOnTouch, {once: true});
    return () => document.removeEventListener('click', retryOnTouch);
  }, [blocked, failed]);
  function start() {
    const player = video.current;
    if (!player) return;
    player.muted = false;
    if (failed) { player.load(); setFailed(false); }
    void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }
  return <section className="parent-intro" aria-label="Знакомство со студией Хан Зама">
    <p className="parent-intro-message" role="status">{done ? 'Видео просмотрено. Теперь можно выбрать фотографии.' : 'Вы сможете посмотреть каталог фотографий после полного просмотра видео. Пока можно выбрать ребёнка ниже.'}</p>
    <div className="parent-intro-player"><video ref={video} src={`${import.meta.env.BASE_URL}media/khan-zama-intro.mp4?v=${parentIntroVersion}`} poster={`${import.meta.env.BASE_URL}media/khan-zama-intro-poster.webp?v=${parentIntroVersion}`} autoPlay={!watched} controls controlsList="nodownload noplaybackrate" playsInline preload="metadata"
      onPlay={() => setBlocked(false)}
      onSeeking={() => { const player = video.current; if (player && !completed.current && player.currentTime > furthest.current + 0.5) player.currentTime = furthest.current; }}
      onTimeUpdate={() => { const player = video.current; if (!player || player.seeking) return; furthest.current = Math.max(furthest.current, player.currentTime); }}
      onEnded={() => { const player = video.current; if (!completed.current && player && Number.isFinite(player.duration) && furthest.current >= player.duration - 1.5) { completed.current = true; setDone(true); setBlocked(true); rememberParentIntro(); onComplete(); player.load(); } }}
      onError={() => { setFailed(true); setBlocked(true); }} />
      {blocked && <button className="parent-intro-start" onClick={event => { event.stopPropagation(); start(); }}>{failed ? 'Повторить загрузку видео' : <><span className="parent-intro-play-icon"><Play size={22} fill="currentColor" /></span><span><strong>Посмотреть видео</strong><small>Как мы сохраняем детские истории</small></span></>}</button>}
    </div>
  </section>;
}
