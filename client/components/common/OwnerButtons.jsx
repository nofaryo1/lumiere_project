import React, { useState } from "react";
import { app } from "../../store/app";
import { deletePerfume, setEditing } from "../../store/perfumePage";

// Edit / Delete for the member who added the perfume, with a confirm step before deleting
export function OwnerButtons({ p, cls }) {
  const { perfumePage } = app.use();
  const [busy, setBusy] = useState(false);
  if (perfumePage.confirmingDelete === p.id) {
    return (
      <>
        <span className="owner-confirm">Delete this perfume?</span>
        <button className={cls} data-cancel-delete="" onClick={() => setEditing({ confirmingDelete: null })}>Cancel</button>
        <button className={`${cls} is-danger`} data-confirm-delete={p.id} disabled={busy}
                onClick={() => { setBusy(true); deletePerfume(p.id).finally(() => setBusy(false)); }}>Yes, delete</button>
      </>
    );
  }
  return (
    <>
      <a className={cls} href={`#edit-perfume/${encodeURIComponent(p.id)}`}>Edit</a>
      <button className={cls} data-delete-perfume={p.id} onClick={() => setEditing({ confirmingDelete: p.id })}>Delete</button>
    </>
  );
}
