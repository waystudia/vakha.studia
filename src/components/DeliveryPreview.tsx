type ParentPreviewMode = "auto" | "print" | "digital";

export function DeliveryPreview({ imageUrl = "", videoUrl = "", title, mode = "auto" }: {
  imageUrl?: string;
  videoUrl?: string;
  title: string;
  mode?: ParentPreviewMode;
}) {
  const showPrint = mode !== "digital" && Boolean(imageUrl);
  const showPhone = mode !== "print" && Boolean(videoUrl || (!showPrint && imageUrl));
  if (!showPrint && !showPhone) return null;
  const phoneHasVideo = Boolean(videoUrl);

  return <section className="delivery-preview" aria-label={`Итог услуги: ${title}`}>
    <div className={`delivery-preview-stage ${showPrint && showPhone ? "has-phone-overlay" : ""}`}>
      {showPrint && <figure className="delivery-paper"><img src={imageUrl} alt={`Распечатанное фото A4: ${title}`} /></figure>}
      {showPhone && <figure className={`delivery-phone ${showPrint ? "overlay" : "standalone"}`}>
        <div className="delivery-phone-screen">
          {phoneHasVideo
            ? <video controls playsInline preload="metadata" poster={imageUrl || undefined} src={videoUrl} aria-label={`Видео услуги ${title}`} />
            : <img src={imageUrl} alt={`Цифровое фото: ${title}`} />}
        </div>
        <figcaption>{phoneHasVideo ? "Видео открывается на телефоне" : "Цифровое фото"}</figcaption>
      </figure>}
    </div>
  </section>;
}
