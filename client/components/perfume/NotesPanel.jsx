import React, { useEffect, useRef, useState } from "react";
import { app } from "../../store/app";
import { NOTES_REQUIRED, canEditNotes, parseNotes, setEditing, submitNotes } from "../../store/perfumePage";
import { NotesBlock } from "../notes/NotesBlock";

function NotesForm({ p }) {
  const { perfumePage } = app.use();
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const input = inputRef.current;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitNotes(p, perfumePage.notesDraft);
    } catch (err) {
      setError(err.message);
      if (err.focus) inputRef.current.focus();
      setBusy(false);
    }
  };

  return (
    <form className="notes-first" id="notesForm" data-slug={p.id} noValidate onSubmit={onSubmit}>
      <p className="notes-first__title">Edit notes</p>
      <p className="pv__hint">{`Exactly ${NOTES_REQUIRED} notes, separated with commas.`}</p>
      <input name="notes" maxLength="300" ref={inputRef} value={perfumePage.notesDraft} placeholder="e.g. Bergamot, Vanilla, Musk" autoComplete="off" aria-label="Notes"
             onChange={(e) => { setEditing({ notesDraft: e.target.value }); setError(""); }} />
      <div className="notes-first__preview" id="notesFormPreview"><NotesBlock notes={parseNotes(perfumePage.notesDraft)} /></div>
      <div className="notes-first__foot">
        <span className="composer__error" id="notesError" role="alert">{error}</span>
        <button type="button" className="btn btn--ghost btn--sm" data-cancel-notes="" onClick={() => setEditing({ editingNotes: null })}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>Save notes</button>
      </div>
    </form>
  );
}

export function NotesPanel({ p }) {
  const { perfumePage } = app.use();
  if (perfumePage.editingNotes === p.id && canEditNotes(p)) return <NotesForm p={p} />;
  return (
    <>
      <NotesBlock notes={p.notes} />
      {p.notes.length && p.notesAddedBy ? (
        <p className="pv__hint notes-credit">Notes added by <a className="member-link" href={`#profile/${encodeURIComponent(p.notesAddedBy)}`}>{`@${p.notesAddedBy}`}</a></p>
      ) : null}
      {canEditNotes(p) ? (
        <p className="pv__hint notes-credit">
          <button className="link link--btn" data-edit-notes="" onClick={() => setEditing({ editingNotes: p.id, notesDraft: p.notes.join(", ") })}>
            {p.notes.length ? "Edit notes" : "Add notes"}
          </button>
        </p>
      ) : null}
    </>
  );
}
