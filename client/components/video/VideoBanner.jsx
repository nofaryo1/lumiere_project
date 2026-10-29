import React, { useState, useRef } from "react";
import { shouldAutoplay } from "./shouldAutoplay";
import { useAutoplayWhileVisible } from "./useAutoplayWhileVisible";
import { VideoCaption } from "./VideoCaption";

const VIDEO_SRC = "/videos/video.mp4";

export function VideoBanner() {
  const videoRef = useRef(null);
  const autoplay = useRef(shouldAutoplay());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useAutoplayWhileVisible(videoRef, autoplay.current);

  if (failed) return null;

  return (
    <div className={`video-banner${ready ? " is-ready" : ""}`}>
      <video
        ref={videoRef}
        className="video-banner__video"
        src={VIDEO_SRC}
        muted
        loop
        playsInline
        preload={autoplay.current ? "metadata" : "auto"}
        aria-label="LUMIERE community video"
        onLoadedData={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      <div className="video-banner__shade" aria-hidden="true" />
      <VideoCaption />
    </div>
  );
}
