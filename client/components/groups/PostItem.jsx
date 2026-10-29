import React, { useEffect, useRef, useState } from "react";
import { app, byId } from "../../store/app";
import { ratingFor } from "../../store/catalog";
import { isMe } from "../../store/session";
import { openAuth, toast } from "../../store/ui";
import { setGroupView, toggleReplies, togglePostLike, deletePost, saveEditedPost, submitReply, toggleMembership } from "../../store/groups";
import { timeAgo } from "../../lib/format";
import { AvatarLink, MemberLink } from "../common/Avatar";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { Icon } from "../common/Icon";

function PerfumeTag({ slug }) {
  const p = byId(slug);
  if (!p) return null;
  const r = ratingFor(p);
  return (
    <a className="gpost__perfume" href={`#perfume/${p.id}`}>
      <PerfumeMedia p={p} size="xs" />
      <span><strong>{p.name}</strong><span>{`${p.brand}${r.count ? ` · ★ ${r.avg.toFixed(1)}` : ""}`}</span></span>
    </a>
  );
}

function LikeButton({ post }) {
  const mine = !!post.user && isMe(post.user.username);
  return (
    <button className="social-btn" data-post-like={post.id} aria-pressed={String(!!post.likedByMe)} disabled={mine} aria-label="Like post" onClick={() => togglePostLike(post)}>
      <Icon name="heart" /><span>{post.likes}</span>
    </button>
  );
}

function EditForm({ post }) {
  const [text, setText] = useState(post.text);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const box = ref.current;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, []);
  const onSubmit = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (value.length < 2) { setError("Please write something first."); return; }
    setBusy(true);
    try {
      await saveEditedPost(post.id, value);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <form className="composer gpost-edit" data-post-edit-form={post.id} data-parent={post.parent || undefined} noValidate onSubmit={onSubmit}>
      <textarea name="text" rows="3" maxLength="2000" aria-label="Edit your post" ref={ref} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="composer__foot">
        <span className="composer__error" data-post-edit-error="" role="alert">{error}</span>
        <button type="button" className="btn btn--ghost btn--sm" data-cancel-post-edit="" onClick={() => setGroupView({ editing: null })}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>Save</button>
      </div>
    </form>
  );
}

function ReplyItem({ reply }) {
  const { groupView } = app.use();
  const mine = isMe(reply.user.username);
  return (
    <li className="greply">
      <AvatarLink user={reply.user} size="avatar--sm" />
      <div className="greply__body">
        <p className="greply__head"><MemberLink user={reply.user} /> <span>{`${timeAgo(reply.createdAt)}${reply.edited ? " · edited" : ""}`}</span></p>
        {mine && groupView.editing === String(reply.id) ? <EditForm post={reply} /> : <p className="greply__text">{reply.text}</p>}
        <div className="greply__actions">
          <LikeButton post={reply} />
          {mine ? (
            <>
              <button className="social-btn" data-post-edit={reply.id} onClick={() => setGroupView({ editing: String(reply.id) })}>Edit</button>
              <button className="social-btn" data-post-delete={reply.id} data-parent={reply.parent} onClick={() => deletePost(reply.id, reply.parent)}>Delete</button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ReplyForm({ postId }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const onSubmit = async (e) => {
    e.preventDefault();
    const input = ref.current;
    const text = input.value.trim();
    if (text.length < 2) { input.focus(); return; }
    setBusy(true);
    try {
      await submitReply(postId, text);
      input.value = "";
      input.focus();
    } catch (err) {
      toast(err.message);
    }
    setBusy(false);
  };
  return (
    <form className="greply-form" data-reply-form={postId} noValidate onSubmit={onSubmit}>
      <input name="text" maxLength="2000" placeholder="Write a reply…" aria-label="Write a reply" autoComplete="off" ref={ref} />
      <button className="btn btn--primary btn--sm" type="submit" disabled={busy}>Reply</button>
    </form>
  );
}

export function PostItem({ post }) {
  const { groupView: v, session } = app.use();
  const g = v.group;
  const mine = isMe(post.user.username);
  const replies = v.replies[post.id];

  let thread = null;
  if (replies) {
    thread = (
      <div className="gpost__thread">
        {replies === "loading" ? <p className="pv__hint">Loading replies…</p> : <ul className="greply-list">{replies.map((r) => <ReplyItem key={r.id} reply={r} />)}</ul>}
        {g.isMember ? <ReplyForm postId={post.id} /> : (
          <p className="pv__hint">{session.user
            ? <><button className="link link--btn" data-join={g.slug} onClick={() => toggleMembership(g.slug)}>{`Join ${g.name}`}</button> to reply.</>
            : <><button className="link link--btn" data-auth="login" onClick={() => openAuth("login")}>Log in</button> and join the group to reply.</>}</p>
        )}
      </div>
    );
  }

  return (
    <article className="gpost" data-post={post.id}>
      <header className="review__head">
        <AvatarLink user={post.user} />
        <div>
          <p className="review__user"><MemberLink user={post.user} /></p>
          <p className="review__meta">{`@${post.user.username} · ${timeAgo(post.createdAt)}${post.edited ? " · edited" : ""}`}</p>
        </div>
      </header>
      {mine && v.editing === String(post.id) ? <EditForm post={post} /> : <p className="gpost__text">{post.text}</p>}
      {post.perfume ? <>{" "}<PerfumeTag slug={post.perfume} />{" "}</> : " "}
      <footer className="review__actions">
        <LikeButton post={post} />
        <button className="social-btn" data-toggle-replies={post.id} aria-expanded={String(!!replies)} onClick={() => toggleReplies(post.id)}>
          <Icon name="comment" /><span>{post.replies}</span> <span className="social-btn__label">{post.replies === 1 ? "reply" : "replies"}</span>
        </button>
        {mine ? (
          <>
            <button className="social-btn" data-post-edit={post.id} onClick={() => setGroupView({ editing: String(post.id) })}>Edit</button>
            <button className="social-btn" data-post-delete={post.id} onClick={() => deletePost(post.id, null)}>Delete</button>
          </>
        ) : null}
      </footer>
      {thread}
    </article>
  );
}
