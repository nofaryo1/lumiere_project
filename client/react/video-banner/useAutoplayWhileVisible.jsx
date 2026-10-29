import { useEffect } from "../shared/react";

// Plays the video only while it is on screen
export function useAutoplayWhileVisible(videoRef, enabled) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return undefined;
    if (!("IntersectionObserver" in window)) { video.play().catch(() => {}); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.25 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);
}
