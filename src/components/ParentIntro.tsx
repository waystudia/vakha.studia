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
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    player.muted = false;
    void player.play().catch(() => setBlocked(true));
  }, []);
  function start() {
    const player = video.current;
    if (!player) return;
    player.muted = false;
    if (failed) { player.load(); setFailed(false); }
    void player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }
  return <section className="parent-intro" aria-label="Знакомство со студией Хан Зама">
    <p className="parent-intro-message" role="status">{done ? 'Видео просмотрено. Теперь можно выбрать фотографии.' : 'Вы сможете посмотреть каталог фотографий после полного просмотра видео. Пока можно выбрать ребёнка ниже.'}</p>
    <div className="parent-intro-player"><video ref={video} src={`${import.meta.env.BASE_URL}media/khan-zama-intro.mp4`} autoPlay controls controlsList="nodownload noplaybackrate" playsInline preload="auto"
      onPlay={() => setBlocked(false)}
      onSeeking={() => { const player = video.current; if (player && !completed.current && player.currentTime > furthest.current + 0.5) player.currentTime = furthest.current; last.current = player?.currentTime || 0; }}
      onTimeUpdate={() => { const player = video.current; if (!player || player.seeking) return; const now = player.currentTime; if (now >= last.current && now - last.current <= 1.5 && now <= furthest.current + 1.5) furthest.current = Math.max(furthest.current, now); last.current = now; }}
      onEnded={() => { const player = video.current; if (!completed.current && player && Number.isFinite(player.duration) && furthest.current >= player.duration - 1.5) { completed.current = true; setDone(true); onComplete(); } }}
      onError={() => { setFailed(true); setBlocked(true); }} />
      {blocked && <button className="parent-intro-start" onClick={start}>{failed ? 'Повторить загрузку видео' : '▶ Смотреть видео со звуком'}</button>}
    </div>
  </section>;
}
