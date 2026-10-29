import React from "react";

const PATHS = {
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z" />,
  thumb: <path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7" />,
  comment: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />,
  share: <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M7 8l5-5 5 5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  back: <path d="M15 6l-6 6 6 6" />,
  next: <path d="M9 6l6 6-6 6" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12l4 4 10-10" />,
  send: <path d="M4 12l16-8-6 16-2-7z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

export function Icon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{PATHS[name]}</svg>;
}

export function UpIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12"><path d="M7 14l5-5 5 5" /></svg>;
}

export function StarIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M10 1.8l2.4 5.2 5.7.6-4.3 3.9 1.2 5.6L10 14.2l-5 2.9 1.2-5.6L1.9 7.6l5.7-.6z" /></svg>;
}

export function LockIcon() {
  return <svg className="nav__lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
}

export function SearchIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
}
