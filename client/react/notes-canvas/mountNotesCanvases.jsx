import { React, ReactDOM } from "../shared/react";
import { NotesCanvas } from "./NotesCanvas";

const roots = new Map();

// Renders a NotesCanvas into every .notes-canvas-root placeholder main.js left inside `scope`
export function mountNotesCanvases(scope = document) {
  roots.forEach((root, el) => {
    if (!el.isConnected) { root.unmount(); roots.delete(el); }
  });
  scope.querySelectorAll(".notes-canvas-root").forEach((el) => {
    if (roots.has(el)) return;
    let notes = [];
    try { notes = JSON.parse(el.dataset.notes || "[]"); } catch (err) { notes = []; }
    const root = ReactDOM.createRoot(el);
    roots.set(el, root);
    // render synchronously so the canvas is there before the page paints (no jump)
    ReactDOM.flushSync(() => {
      root.render(<NotesCanvas notes={notes} animateKey={`${location.hash}|${JSON.stringify(notes)}`} />);
    });
  });
}
