"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  previewImageUrl: string | null;
  videoUrl: string;
  className?: string;
};

function stripUrlFragment(url: string): string {
  const i = url.indexOf("#");
  return i === -1 ? url : url.slice(0, i);
}

/**
 * Grid thumbnail: prefer first scene still; on load error or missing URL, show a decoded
 * video frame (programmatic seek works more reliably than `#t=` for portrait MP4s).
 */
export function StoryCardThumbnail({
  previewImageUrl,
  videoUrl,
  className = "pointer-events-none absolute inset-0 h-full w-full object-cover",
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setImageFailed(false);
  }, [previewImageUrl, videoUrl]);

  useEffect(() => {
    if (previewImageUrl && !imageFailed) return;
    const v = videoRef.current;
    if (!v) return;

    const clean = stripUrlFragment(videoUrl.trim());
    if (!clean) return;

    const bumpFrame = () => {
      try {
        const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
        const t = d > 0 ? Math.min(1, Math.max(0.08, d * 0.04)) : 0.25;
        v.currentTime = t;
      } catch {
        /* ignore */
      }
    };

    const onMeta = () => bumpFrame();
    const onSeeked = () => {
      try {
        v.pause();
      } catch {
        /* ignore */
      }
    };

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("seeked", onSeeked);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("seeked", onSeeked);
    };
  }, [previewImageUrl, imageFailed, videoUrl]);

  if (previewImageUrl && !imageFailed) {
    return (
      <img
        src={previewImageUrl}
        alt=""
        className={className}
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      key={stripUrlFragment(videoUrl.trim())}
      src={stripUrlFragment(videoUrl.trim())}
      muted
      playsInline
      preload="auto"
      className={className}
      aria-hidden
    />
  );
}
