import { useEffect, useRef, useState } from 'react';
import './ParentIntro.css';

export function ParentIntro({onComplete}: {onComplete: () => void}) {
  const video = useRef<HTMLVideoElement>(null);
  const furthest = useRef(0);
  const last = useRef(0);
  const completed = useRef(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [aspect, setAspect] = useState(9 / 16);
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    player.muted = false;
    void player.play().catch(() => setBlocked(true));
  }, []);
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
    <div className="parent-intro-player" style={{width: `min(100%, ${52 * aspect}dvh)`}}><video ref={video} src={`${import.meta.env.BASE_URL}media/khan-zama-intro.mp4`} autoPlay controls controlsList="nodownload noplaybackrate" playsInline preload="auto"
      onLoadedMetadata={() => { const player = video.current; if (player && player.videoWidth > 0 && player.videoHeight > 0) setAspect(player.videoWidth / player.videoHeight); }}
      onPlay={() => setBlocked(false)}
      onSeeking={() => { const player = video.current; if (player && !completed.current && player.currentTime > furthest.current + 0.5) player.currentTime = furthest.current; last.current = player?.currentTime || 0; }}
      onTimeUpdate={() => { const player = video.current; if (!player || player.seeking) return; const now = player.currentTime; if (now >= last.current && now - last.current <= 1.5 && now <= furthest.current + 1.5) furthest.current = Math.max(furthest.current, now); last.current = now; }}
      onEnded={() => { const player = video.current; if (!completed.current && player && Number.isFinite(player.duration) && furthest.current >= player.duration - 1.5) { completed.current = true; setDone(true); onComplete(); } }}
      onError={() => { setFailed(true); setBlocked(true); }} />
      {blocked && <button className="parent-intro-start" onClick={start}>{failed ? 'Повторить загрузку видео' : '▶ Смотреть видео со звуком'}</button>}
    </div>
  </section>;
}
