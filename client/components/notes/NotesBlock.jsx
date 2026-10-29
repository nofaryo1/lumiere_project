import React from "react";
import { NotesCanvas } from "./NotesCanvas";

// The notes drawn on a canvas, or a hint when there are none
export function NotesBlock({ notes, emptyText = "No notes added yet." }) {
  if (!notes.length) return <p className="pv__hint notes-canvas__empty">{emptyText}</p>;
  return (
    <div className="notes-canvas-root" data-notes={JSON.stringify(notes)}>
      <NotesCanvas notes={notes} animateKey={`${location.hash}|${JSON.stringify(notes)}`} />
    </div>
  );
}
