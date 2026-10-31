/** Web previews only: the CRM archive remains the source for printing. */
export async function optimizeCatalogImage(source: Blob): Promise<Blob> {
  if (!source.type.startsWith("image/") || source.type === "image/gif") return source;
  const bitmap = await createImageBitmap(source);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить фото каталога");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось сжать фото")), "image/webp", .78));
    return result.size < source.size ? result : source;
  } finally { bitmap.close(); }
}

type CapturableVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

/** Re-encode oversized previews only where capture includes the source audio. */
export async function optimizeCatalogVideo(source: Blob): Promise<Blob> {
  if (source.size < 3 * 1024 * 1024 || typeof MediaRecorder === "undefined") return source;
  const mime = "video/mp4;codecs=avc1.42E01E,mp4a.40.2";
  const video = document.createElement("video") as CapturableVideo;
  if (!video.captureStream || !MediaRecorder.isTypeSupported(mime)) return source;
  const url = URL.createObjectURL(source);
  let stream: MediaStream | undefined;
  let recording: MediaStream | undefined;
  let frame = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    video.playsInline = true;
    video.src = url;
    video.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Не удалось прочитать видео для сжатия")), 30000);
      video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
      video.onerror = () => reject(new Error("Видео в архиве не воспроизводится"));
    });
    if (!Number.isFinite(video.duration) || video.duration > 180) return source;
    stream = video.captureStream();
    // Never risk dropping an interview's audio on browsers with incomplete capture.
    if (!stream.getAudioTracks().length) return source;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const context = canvas.getContext("2d");
    if (!context) return source;
    recording = canvas.captureStream(24);
    for (const track of stream.getAudioTracks()) recording.addTrack(track);
    const recorder = new MediaRecorder(recording, { mimeType: mime, videoBitsPerSecond: 1200000, audioBitsPerSecond: 96000 });
    const chunks: Blob[] = [];
    const result = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/mp4" }));
      recorder.onerror = () => reject(new Error("Ошибка сжатия видео"));
      video.onended = () => { if (recorder.state !== "inactive") recorder.stop(); };
      timeout = setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); reject(new Error("Сжатие видео прервано: держите вкладку открытой")); }, (video.duration + 30) * 1000);
    });
    const draw = () => { context.drawImage(video, 0, 0, canvas.width, canvas.height); frame = requestAnimationFrame(draw); };
    recorder.start(1000);
    draw();
    await video.play();
    const compressed = await result;
    return compressed.size > 0 && compressed.size < source.size ? compressed : source;
  } finally {
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    video.pause();
    recording?.getTracks().forEach((track) => track.stop());
    stream?.getTracks().forEach((track) => track.stop());
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
