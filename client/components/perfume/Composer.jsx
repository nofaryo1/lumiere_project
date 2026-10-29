import React, { useState } from "react";
import { StarIcon } from "../common/Icon";
import { STAR_LABELS, saveReview, setEditing } from "../../store/perfumePage";

// Rate & review form; also used to edit the member's own review
export function Composer({ p, draft, again }) {
  const [rating, setRating] = useState(draft ? draft.rating : 0);
  const [text, setText] = useState(draft ? draft.text : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    const box = e.currentTarget.text;
    if (!rating) { setError("Please choose a star rating."); return; }
    if (value.length < 10) { setError("Please write at least a few words (10+ characters)."); box.focus(); return; }
    setBusy(true);
    try {
      await saveReview(p, rating, value);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="composer" id="reviewForm" data-rating={rating} noValidate onSubmit={onSubmit}>
      <p className="composer__title">{draft ? "Edit your review" : again ? `Write another review of ${p.name}` : `Rate & review ${p.name}`}</p>
      <div className="composer__rating">
        <div className="star-input" role="radiogroup" aria-label="Your rating">
          {[5, 4, 3, 2, 1].map((n) => (
            <button key={n} type="button" className={`star-input__star${n <= rating ? " is-on" : ""}`} data-star={n} role="radio"
                    aria-checked={String(n === rating)} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    onClick={() => { setRating(n); setError(""); }}><StarIcon /></button>
          ))}
        </div>
        <span className="composer__label" id="starLabel">{rating ? STAR_LABELS[rating - 1] : "Tap a star to rate"}</span>
      </div>
      <textarea name="text" rows="4" maxLength="1000" aria-label="Your review"
        placeholder="What does it smell like? How long does it last? When do you wear it?"
        value={text} onChange={(e) => { setText(e.target.value); setError(""); }} />
      <div className="composer__foot">
        <span className="composer__error" id="composerError" role="alert">{error}</span>
        <span className="composer__count" id="charCount">{`${text.length} / 1000`}</span>
        {draft ? <button type="button" className="btn btn--ghost btn--sm" data-cancel-edit="" onClick={() => setEditing({ editingReview: null })}>Cancel</button> : null}
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>{draft ? "Save changes" : "Post review"}</button>
      </div>
    </form>
  );
}
