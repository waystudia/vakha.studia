import { useEffect, useRef, useState } from "react";
import './ParentIntro.css';

export function ParentIntro({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [watched, setWatched] = useState(0);
  const canSkip = watched >= 10;
  useEffect(() => {
    const player = video.current;
    if (!player) return;
    player.muted = false;
    player.play().catch(() => { player.pause(); player.currentTime = 0; setBlocked(true); });
  }, []);
  useEffect(() => {
    // Count real playback time, not seeking or time spent on the start screen.
    const timer = window.setInterval(() => {
      const player = video.current;
      if (player && !player.paused && !player.ended && player.readyState >= 3 && !document.hidden)
        setWatched(value => Math.min(10, value + 0.25));
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && canSkip) onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose, canSkip]);
  function start() {
    const player = video.current;
    if (!player) return;
    player.currentTime = 0;
    player.muted = false;
    setMuted(false);
    player.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }
  return <section className="parent-intro" aria-label="Знакомство со студией Хан Зама">
    <header><strong>Khan Zama</strong>{canSkip ? <button onClick={onClose}>Пропустить →</button> : <span>Пропустить через {Math.ceil(10 - watched)} с</span>}</header>
    <video ref={video} src={`${import.meta.env.BASE_URL}media/khan-zama-intro.mp4`} muted={muted} playsInline preload="auto" onPlay={() => setPaused(false)} onPause={() => setPaused(true)} onEnded={onClose} onError={onClose} />
    <footer>{blocked ? <button autoFocus onClick={start}>Смотреть со звуком</button> : <><button onClick={() => { const player = video.current; if (!player) return; if (player.paused) player.play().catch(() => setBlocked(true)); else player.pause(); }}>{paused ? 'Продолжить' : 'Пауза'}</button><button onClick={() => setMuted(!muted)}>{muted ? 'Включить звук' : 'Выключить звук'}</button></>}</footer>
  </section>;
}
