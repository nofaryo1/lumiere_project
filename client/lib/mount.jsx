import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

// Renders the app into #root synchronously, so the first paint already has the page
export function mount(Component) {
  const node = document.getElementById("root");
  if (!node) return;
  const root = createRoot(node);
  flushSync(() => root.render(<Component />));
}
