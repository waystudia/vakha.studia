import { Play, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { catalogMediaUrl } from "../lib/mediaUrl";

type ParentPreviewMode = "auto" | "print" | "digital";

export function DeliveryPreview({ imageUrl = "", videoUrl = "", title, mode = "auto" }: {
  imageUrl?: string;
  videoUrl?: string;
  title: string;
  mode?: ParentPreviewMode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const showPrint = mode !== "digital" && Boolean(imageUrl);
  const showPhone = mode !== "print" && Boolean(videoUrl || (!showPrint && imageUrl));
  if (!showPrint && !showPhone) return null;
  const phoneHasVideo = Boolean(videoUrl);
  const startVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    setVideoError(false);
    // Preview loops on catalog cards are muted by browser policy. A parent
    // explicitly pressing this control expects the full, audible result.
    video.muted = false;
    video.defaultMuted = false;
    video.volume = 1;
    try {
      await video.play();
    } catch {
      setVideoError(true);
    }
  };
  const retryVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.load();
    void startVideo();
  };

  return <section className="delivery-preview" aria-label={`Итог услуги: ${title}`}>
    <div className={`delivery-preview-stage ${showPrint && showPhone ? "has-phone-overlay" : ""}`}>
      {showPrint && <figure className="delivery-paper"><img src={imageUrl} alt={`Распечатанное фото A4: ${title}`} /><figcaption className="delivery-lamination">Ламинация · защита</figcaption></figure>}
      {showPhone && <figure className={`delivery-phone ${showPrint ? "overlay" : "standalone"}`}>
        <div className="delivery-phone-screen">
          {phoneHasVideo
            ? <video ref={videoRef} controls playsInline preload="metadata" poster={imageUrl || undefined} src={catalogMediaUrl(videoUrl)} aria-label={`Видео услуги ${title}`} onError={() => setVideoError(true)} />
            : <img src={imageUrl} alt={`Цифровое фото: ${title}`} />}
        </div>
        <figcaption>{phoneHasVideo ? "Видео открывается на телефоне" : "Цифровое фото"}</figcaption>
      </figure>}
    </div>
    {phoneHasVideo && <div className="delivery-video-actions">
      <button className="button button-secondary" type="button" onClick={videoError ? retryVideo : () => void startVideo()}>
        {videoError ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}
        {videoError ? "Повторить видео" : "Посмотреть видео"}
      </button>
      {videoError && <p role="alert">Видео не загрузилось. Нажмите «Повторить видео» или обновите страницу.</p>}
    </div>}
  </section>;
}
