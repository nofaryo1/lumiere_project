/* =========================================================
   LUMIERE — Homepage video banner (React)
   Rendered with ReactDOM.createRoot into #videoBannerRoot,
   above the "Find your next favorite fragrance" section.
   Plays /videos/video.mp4 muted on a loop; pauses when scrolled
   out of view; doesn't autoplay for reduced-motion or data-saver.
   Written with React.createElement (no build step / JSX).
   ========================================================= */
(function () {
  "use strict";

  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  const VIDEO_SRC = "/videos/video.mp4";

  const ICONS = {
    play: "M8 5v14l11-7z",
    pause: "M7 5h4v14H7zM13 5h4v14h-4z",
    soundOff: "M4 9v6h4l5 4V5L8 9zM16 9l5 6M21 9l-5 6",
    soundOn: "M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12",
  };

  function Icon({ path, filled }) {
    return h("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", className: filled ? "is-filled" : "" },
      h("path", { d: path }));
  }

  function shouldAutoplay() {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    return !reduced && !saveData;
  }

  function VideoBanner() {
    const videoRef = useRef(null);
    const wantsPlay = useRef(shouldAutoplay());   // what the visitor wants (vs. paused because off-screen)
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    // Play only while the banner is on screen
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !("IntersectionObserver" in window)) return undefined;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && wantsPlay.current) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      }, { threshold: 0.25 });
      observer.observe(video);
      return () => observer.disconnect();
    }, []);

    function togglePlay() {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        wantsPlay.current = true;
        video.play().catch(() => {});
      } else {
        wantsPlay.current = false;
        video.pause();
      }
    }

    function toggleSound() {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setMuted(video.muted);
      if (!video.muted && video.paused) { wantsPlay.current = true; video.play().catch(() => {}); }
    }

    if (failed) return null;   // no video -> the homepage simply starts with the hero

    return h("div", { className: `video-banner${ready ? " is-ready" : ""}` },
      h("video", {
        ref: videoRef,
        className: "video-banner__video",
        src: VIDEO_SRC,
        muted: true,
        loop: true,
        playsInline: true,
        preload: "metadata",
        "aria-label": "LUMIERE community video",
        onLoadedData: () => setReady(true),
        onPlay: () => setPlaying(true),
        onPause: () => setPlaying(false),
        onError: () => setFailed(true),
      }),
      h("div", { className: "video-banner__shade", "aria-hidden": "true" }),
      h("div", { className: "video-banner__caption" },
        h("p", { className: "video-banner__eyebrow" }, "Welcome to LUMIERE"),
        h("p", { className: "video-banner__title" }, "Discover, review and share the scents you love")),
      h("div", { className: "video-banner__controls" },
        h("button", {
          type: "button",
          className: "video-banner__btn",
          onClick: togglePlay,
          "aria-label": playing ? "Pause video" : "Play video",
          title: playing ? "Pause" : "Play",
        }, h(Icon, { path: playing ? ICONS.pause : ICONS.play, filled: true })),
        h("button", {
          type: "button",
          className: "video-banner__btn",
          onClick: toggleSound,
          "aria-label": muted ? "Turn sound on" : "Turn sound off",
          "aria-pressed": String(!muted),
          title: muted ? "Sound on" : "Sound off",
        }, h(Icon, { path: muted ? ICONS.soundOff : ICONS.soundOn }))));
  }

  const container = document.getElementById("videoBannerRoot");
  if (container) ReactDOM.createRoot(container).render(h(VideoBanner));
})();
