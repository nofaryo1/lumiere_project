(function () {
  "use strict";

  const { useState, useEffect, useRef } = React;
  const h = React.createElement;

  const VIDEO_SRC = "/videos/video.mp4";

  function shouldAutoplay() {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    return !reduced && !saveData;
  }

  function VideoBanner() {
    const videoRef = useRef(null);
    const autoplay = useRef(shouldAutoplay());
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      const video = videoRef.current;
      if (!video || !autoplay.current) return undefined;
      if (!("IntersectionObserver" in window)) { video.play().catch(() => {}); return undefined; }
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }, { threshold: 0.25 });
      observer.observe(video);
      return () => observer.disconnect();
    }, []);

    if (failed) return null;

    return h("div", { className: `video-banner${ready ? " is-ready" : ""}` },
      h("video", {
        ref: videoRef,
        className: "video-banner__video",
        src: VIDEO_SRC,
        muted: true,
        loop: true,
        playsInline: true,
        preload: autoplay.current ? "metadata" : "auto",
        "aria-label": "LUMIERE community video",
        onLoadedData: () => setReady(true),
        onError: () => setFailed(true),
      }),
      h("div", { className: "video-banner__shade", "aria-hidden": "true" }),
      h("div", { className: "video-banner__caption" },
        h("p", { className: "video-banner__eyebrow" }, "Welcome to LUMIERE"),
        h("p", { className: "video-banner__title" }, "Discover, review and share the scents you love")));
  }

  const container = document.getElementById("videoBannerRoot");
  if (container) ReactDOM.createRoot(container).render(h(VideoBanner));
})();
