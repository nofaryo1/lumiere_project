import React, { useEffect, useRef, useState } from "react";
import { byId } from "../../store/app";
import { families, BLANK_LOOK } from "../../store/catalog";
import { NOTES_REQUIRED, notesCountError, parseNotes, createPerfume, saveEditedPerfume, checkPerfumeExists } from "../../store/perfumePage";
import { toast } from "../../store/ui";
import { Crumbs } from "../common/BackButton";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { FieldError } from "../layout/FieldError";
import { NotesBlock } from "../notes/NotesBlock";

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_MAX_SIDE = 1600;

// Any photo the browser can read, made at most 1600px and saved as a JPEG
async function preparePhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode failed");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

function DuplicateNotice({ existing }) {
  if (!existing) return <div className="notice" id="dupNotice" role="status" hidden />;
  const label = `${existing.brand ? existing.brand + " " : ""}${existing.name}`;
  return (
    <div className="notice" id="dupNotice" role="status">
      <div>
        <strong>{`Good news — ${label} is already on LUMIERE.`}</strong>
        <p>No need to add it again. You can like it, rate it and write your review on its page.</p>
      </div>
      <a className="btn btn--primary btn--sm" href={`#perfume/${encodeURIComponent(existing.slug)}`}>{`View ${label} →`}</a>
    </div>
  );
}

export function PerfumeForm({ id }) {
  const edit = id ? byId(id) : null;
  const formRef = useRef(null);
  const fileRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [edited, setEdited] = useState({});
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notesPreview, setNotesPreview] = useState(edit ? edit.notes : []);
  const [preview, setPreview] = useState(null);
  const photo = useRef(null);
  const photoWork = useRef(null);
  const dupTimer = useRef(0);
  const dupRequest = useRef(0);

  useEffect(() => () => clearTimeout(dupTimer.current), []);

  const showDuplicate = (existing) => { setDuplicate(existing); setBlocked(!!existing); };

  const checkDuplicateSoon = () => {
    clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      const form = formRef.current;
      if (!form) return;
      const brand = form.brand.value.trim();
      const name = form.name.value.trim();
      if (!name) return showDuplicate(null);
      const reqId = ++dupRequest.current;
      try {
        const res = await checkPerfumeExists(brand, name, edit && edit.id);
        if (reqId === dupRequest.current) showDuplicate(res.exists ? res.perfume : null);
      } catch (err) {}
    }, 350);
  };

  // typing in a field takes away its red outline (the message stays until the next submit)
  const clearFieldError = (e) => setEdited((x) => ({ ...x, [e.target.name]: true }));

  const choosePhoto = (file) => {
    setErrors((x) => ({ ...x, photo: "" }));
    photo.current = null;
    if (!file) { photoWork.current = null; setPreview(null); if (fileRef.current) fileRef.current.value = ""; return; }
    photoWork.current = preparePhoto(file)
      .then((ready) => {
        if (ready.size > MAX_PHOTO) throw new Error("too big");
        photo.current = ready;
        setPreview(URL.createObjectURL(ready));
        return "";
      })
      .catch(() => {
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
        const error = "We couldn't read that photo. Please choose a JPG, PNG or WebP image.";
        setErrors((x) => ({ ...x, photo: error }));
        return error;
      })
      .finally(() => { photoWork.current = null; });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = {
      brand: form.brand.value.trim(),
      name: form.name.value.trim(),
      tags: [...form.querySelectorAll("input[name=tags]:checked")].map((c) => c.value),
      notes: form.notes.value,
    };
    const fields = {};
    if (!body.brand) fields.brand = "Please enter the brand.";
    if (!body.name) fields.name = "Please enter the perfume's name.";
    const notesError = notesCountError(parseNotes(body.notes));
    if (notesError) fields.notes = notesError;
    let photoError = errors.photo || "";
    if (photoWork.current) photoError = await photoWork.current;
    if (photoError) fields.photo = photoError;
    else if (!photo.current && !edit) fields.photo = "Please add a photo of the perfume.";
    setErrors(fields);
    setEdited({});
    setMessage("");
    if (Object.keys(fields).length) return;

    setBusy(true);
    try {
      if (edit) await saveEditedPerfume(edit, body, photo.current);
      else await createPerfume(body, photo.current);
      photo.current = null;
    } catch (err) {
      if (err.status === 409 && err.data.existing) {
        showDuplicate(err.data.existing);
        if (!edit) toast("This perfume is already on LUMIERE — here's the link");
      } else {
        setErrors((err.data && err.data.fields) || {});
        setEdited({});
        setMessage(err.message);
      }
      setBusy(false);
    }
  };

  const look = edit ? edit.look : BLANK_LOOK;
  const shown = { name: preview ? "Preview" : edit ? edit.name : "", image: preview || (edit ? edit.image : ""), look };
  const invalid = (name) => (errors[name] && !edited[name] ? "" : undefined);

  return (
    <div className="container pv">
      <Crumbs>
        <span>{"Perfumes / "}{edit ? <>{`${edit.name} / `}<strong>Edit</strong></> : <strong>Add a perfume</strong>}</span>
      </Crumbs>

      <div className="add">
        <section className="panel add__form-panel">
          <h1 className="add__title">{edit ? "Edit perfume" : "Add a perfume"}</h1>
          <p className="section-sub">{edit ? `Update the details of ${edit.name}.` : "Can't find a perfume on LUMIERE? Add it so the community can rate and review it."}</p>

          <form id="addForm" className="add__form" noValidate data-editing={edit ? edit.id : undefined} ref={formRef} onSubmit={onSubmit}>
            <div className="add__row">
              <label className="field">
                <span className="field__label">Brand</span>
                <input name="brand" maxLength="60" placeholder="e.g. Creed" autoComplete="off" required defaultValue={edit ? edit.brand || "" : undefined}
                       aria-invalid={invalid("brand")} onChange={(e) => { clearFieldError(e); checkDuplicateSoon(); }} />
                <FieldError name="brand" errors={errors} />
              </label>
              <label className="field">
                <span className="field__label">Perfume name</span>
                <input name="name" maxLength="80" placeholder="e.g. Aventus" autoComplete="off" required defaultValue={edit ? edit.name || "" : undefined}
                       aria-invalid={invalid("name")} onChange={(e) => { clearFieldError(e); checkDuplicateSoon(); }} />
                <FieldError name="name" errors={errors} />
              </label>
            </div>

            <DuplicateNotice existing={duplicate} />

            <fieldset className="field">
              <legend className="field__label">Scent family <span className="field__optional">(pick all that fit)</span></legend>
              <div className="check-chips">
                {families.map((f) => (
                  <label className="check-chip" key={f.key}><input type="checkbox" name="tags" value={f.key} defaultChecked={!!edit && edit.tags.includes(f.key)} /><span>{f.name}</span></label>
                ))}
              </div>
            </fieldset>

            <label className="field">
              <span className="field__label">Main notes <span className="field__optional">{`(exactly ${NOTES_REQUIRED}, separate with commas)`}</span></span>
              <input name="notes" maxLength="300" placeholder="e.g. Bergamot, Vanilla, Musk" autoComplete="off" required defaultValue={edit ? edit.notes.join(", ") : undefined}
                     aria-invalid={invalid("notes")} onChange={(e) => setNotesPreview(parseNotes(e.target.value))} />
              <FieldError name="notes" errors={errors} />
            </label>
            <div className="notes-preview" id="notesPreview" aria-live="polite">
              <NotesBlock notes={notesPreview} emptyText="Type notes above to preview them here." />
            </div>

            <div className="field">
              <span className="field__label">Photo <span className="field__optional">{edit ? "(choose a new one to replace it · any size, we'll resize it)" : "(required · any size, we'll resize it)"}</span></span>
              <div className="add__photo">
                <div className="add__preview" id="photoPreview">
                  <PerfumeMedia p={shown} size="sm" />
                </div>
                <label className="btn btn--ghost btn--sm add__file">
                  <input type="file" id="photoInput" accept="image/*" ref={fileRef} onChange={(e) => choosePhoto(e.target.files[0] || null)} />
                  Choose a photo
                </label>
                <button type="button" className="link link--btn" id="photoRemove" hidden={!preview} onClick={() => choosePhoto(null)}>Remove</button>
              </div>
              <FieldError name="photo" errors={errors} />
            </div>

            <div className="add__foot">
              <span className="composer__error" id="addError" role="alert">{message}</span>
              <button type="submit" className="btn btn--primary" id="addSubmit" disabled={busy || blocked}>
                {busy ? (edit ? "Saving…" : "Adding…") : (edit ? "Save changes" : "Add perfume")}
              </button>
            </div>
          </form>
        </section>

        <aside className="panel add__tips">
          <h2 className="panel__title">Before you add</h2>
          <ul>
            <li>Search first — we'll also warn you if the perfume is already here.</li>
            <li>Use the official name, e.g. <em>Aventus</em> by <em>Creed</em>.</li>
            <li>A clear photo of the bottle on a plain background works best.</li>
            <li>After adding, be the first to rate and review it!</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
