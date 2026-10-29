import React, { useRef, useState } from "react";
import { families } from "../../store/catalog";
import { groupBySlug, checkGroupName, createGroup, saveEditedGroup } from "../../store/groups";
import { Crumbs } from "../common/BackButton";
import { FieldError } from "../layout/FieldError";

function DuplicateNotice({ existing }) {
  if (!existing) return <div className="notice" id="groupDupNotice" role="status" hidden />;
  return (
    <div className="notice" id="groupDupNotice" role="status">
      <div><strong>{`“${existing.name}” already exists.`}</strong><p>Join it instead, or pick a different name.</p></div>
      <a className="btn btn--primary btn--sm" href={`#group/${encodeURIComponent(existing.slug)}`}>View group →</a>
    </div>
  );
}

// Create a group, or edit one you created
export function GroupForm({ slug }) {
  const edit = slug ? groupBySlug(slug) : null;
  const [errors, setErrors] = useState({});
  const [nameEdited, setNameEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(0);

  const checkNameSoon = (name) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (name.trim().length < 3) return setDuplicate(null);
      try {
        const res = await checkGroupName(name, edit && edit.slug);
        setDuplicate(res.exists ? res.group : null);
      } catch (err) {}
    }, 300);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const body = { name: form.name.value.trim(), description: form.description.value.trim(), family: form.family.value };
    const fields = {};
    if (body.name.length < 3) fields.name = "Please give the group a name (3+ characters).";
    if (body.description.length < 10) fields.description = "Tell people what the group is about (10+ characters).";
    setErrors(fields);
    setNameEdited(false);
    if (Object.keys(fields).length) return;
    setBusy(true);
    try {
      if (edit) await saveEditedGroup(edit.slug, body);
      else await createGroup(body);
    } catch (err) {
      if (err.status === 409 && err.data.existing) setDuplicate(err.data.existing);
      else {
        setErrors((err.data && err.data.fields) || {});
        setMessage(err.message);
      }
      setBusy(false);
    }
  };

  return (
    <div className="container pv">
      <Crumbs>
        <span><a className="link" href="#groups">Groups</a>{" / "}{edit ? <>{`${edit.name} / `}<strong>Edit</strong></> : <strong>Create a group</strong>}</span>
      </Crumbs>
      <div className="add">
        <section className="panel add__form-panel">
          <h1 className="add__title">{edit ? "Edit group" : "Create a group"}</h1>
          <p className="section-sub">{edit ? `Update the name, description or scent family of ${edit.name}.` : "Start a space for a style, a house or a question you care about. You'll join it automatically."}</p>
          <form id="createGroupForm" className="add__form" noValidate data-editing={edit ? edit.slug : undefined} onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Group name</span>
              <input name="name" maxLength="60" placeholder="e.g. Vetiver Fans" autoComplete="off" required defaultValue={edit ? edit.name : undefined}
                     aria-invalid={errors.name && !nameEdited ? "" : undefined}
                     onChange={(e) => { setNameEdited(true); checkNameSoon(e.target.value); }} />
              <FieldError name="name" errors={errors} />
            </label>
            <DuplicateNotice existing={duplicate} />
            <label className="field">
              <span className="field__label">What is it about?</span>
              <textarea name="description" rows="3" maxLength="240" placeholder="Tell people what the group discusses" required defaultValue={edit ? edit.description : undefined}
                        aria-invalid={errors.description ? "" : undefined} />
              <FieldError name="description" errors={errors} />
            </label>
            <fieldset className="field">
              <legend className="field__label">Scent family <span className="field__optional">(optional)</span></legend>
              <div className="check-chips">
                <label className="check-chip"><input type="radio" name="family" value="" defaultChecked={!edit || !edit.family} /><span>None</span></label>
                {families.map((f) => (
                  <label className="check-chip" key={f.key}><input type="radio" name="family" value={f.key} defaultChecked={!!edit && edit.family === f.key} /><span>{f.name}</span></label>
                ))}
              </div>
            </fieldset>
            <div className="add__foot">
              <span className="composer__error" id="createGroupError" role="alert">{message}</span>
              <button type="submit" className="btn btn--primary" id="createGroupSubmit" disabled={busy || !!duplicate}>
                {edit ? (busy ? "Saving…" : "Save changes") : "Create group"}
              </button>
            </div>
          </form>
        </section>
        <aside className="panel add__tips">
          <h2 className="panel__title">Tips</h2>
          <ul>
            <li>Check the <a className="link" href="#groups">existing groups</a> first — we'll warn you if the name is taken.</li>
            <li>Keep the name short and clear.</li>
            <li>Kick things off with a first post once it's created.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
