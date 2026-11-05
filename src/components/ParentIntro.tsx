import { useEffect, useRef, useState } from "react";
import './ParentIntro.css';

export function ParentIntro({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    video.current?.play().catch(() => setBlocked(true));
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return <section className="parent-intro" aria-label="Знакомство со студией Хан Зама">
    <header><strong>Khan Zama</strong><button autoFocus onClick={onClose}>Пропустить →</button></header>
    <video ref={video} src={`${import.meta.env.BASE_URL}media/khan-zama-intro.mp4`} autoPlay muted={muted} playsInline controls preload="metadata" onEnded={onClose} onError={onClose} />
    <footer>{blocked ? <button onClick={() => { video.current?.play().then(() => setBlocked(false)).catch(() => {}); }}>Смотреть видео</button> : <button onClick={() => setMuted(!muted)}>{muted ? 'Включить звук' : 'Выключить звук'}</button>}<button onClick={onClose}>Перейти в каталог</button></footer>
  </section>;
}
