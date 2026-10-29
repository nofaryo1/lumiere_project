import React, { useState } from "react";
import { app, byId } from "../../store/app";
import { families } from "../../store/catalog";
import { setGroupView, setPostsQuery, loadGroupPosts, perfumeFromLabel, submitPost, deleteGroup } from "../../store/groups";
import { toast } from "../../store/ui";
import { formatCount } from "../../lib/format";
import { Crumbs } from "../common/BackButton";
import { AvatarLink, MemberLink } from "../common/Avatar";
import { JoinPrompt } from "../common/JoinPrompt";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { GroupIcon, JoinButton } from "./GroupCard";
import { PostItem } from "./PostItem";

const SINCE = [["", "Any time"], ["week", "Past week"], ["month", "Past month"], ["year", "Past year"]];

function PostForm({ g }) {
  const { perfumes } = app.use();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = form.text.value.trim();
    const tagged = perfumeFromLabel(form.perfume.value);
    if (text.length < 2) { setError("Please write something first."); form.text.focus(); return; }
    if (tagged === undefined) { setError("Pick a perfume from the list, or leave it empty."); form.perfume.focus(); return; }
    setBusy(true);
    try {
      await submitPost(text, tagged ? tagged.id : null);
      form.reset();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <form className="composer" id="postForm" noValidate onSubmit={onSubmit} onInput={() => setError("")}>
      <p className="composer__title">Start a discussion</p>
      <textarea name="text" rows="3" maxLength="2000" aria-label="Your post" placeholder={`Ask a question or share something with ${g.name}…`} />
      <div className="composer__foot">
        <input className="composer__perfume" name="perfume" list="perfumeOptions" placeholder="Tag a perfume (optional)" aria-label="Tag a perfume" autoComplete="off" />
        <span className="composer__error" id="postError" role="alert">{error}</span>
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>Post</button>
      </div>
      <datalist id="perfumeOptions">{perfumes.map((p) => <option key={p.id} value={`${p.brand ? p.brand + " " : ""}${p.name}`} />)}</datalist>
    </form>
  );
}

function CreatorActions({ g, v }) {
  const [busy, setBusy] = useState(false);
  if (v.confirmDelete) {
    const confirm = async () => {
      setBusy(true);
      try {
        await deleteGroup();
      } catch (err) {
        setBusy(false);
        toast(err.message);
      }
    };
    return (
      <>
        <span className="owner-confirm">Delete this group and all its posts?</span>
        <button className="btn btn--ghost btn--sm" data-cancel-group-delete="" onClick={() => setGroupView({ confirmDelete: false })}>Cancel</button>
        <button className="btn btn--danger btn--sm" data-confirm-group-delete="" disabled={busy} onClick={confirm}>Yes, delete</button>
      </>
    );
  }
  return (
    <>
      <a className="btn btn--ghost btn--follow-lg" href={`#edit-group/${encodeURIComponent(g.slug)}`}>Edit group</a>
      <button className="btn btn--ghost btn--follow-lg" data-delete-group="" onClick={() => setGroupView({ confirmDelete: true })}>Delete group</button>
    </>
  );
}

export function GroupPage() {
  const { groupView: v, session } = app.use();
  if (!v.group) {
    return <div className="container pv"><Crumbs label={false} /><p className="pv__empty">{v.error ? v.error : "Loading group…"}</p></div>;
  }
  const g = v.group;
  const created = new Date(g.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const familyName = g.family ? families.find((f) => f.key === g.family).name : "";
  const isCreator = !!(session.user && g.createdBy && g.createdBy.username === session.user.username);
  const searchingPosts = !!(v.q.trim() || v.since);

  let writeArea;
  if (!session.user) writeArea = <JoinPrompt>{`Join the community to take part in ${g.name}.`}</JoinPrompt>;
  else if (!g.isMember) {
    writeArea = (
      <div className="join-prompt">
        <p>{`Join ${g.name} to start discussions and reply to posts.`}</p>
        <JoinButton g={g} />
      </div>
    );
  } else writeArea = <PostForm g={g} />;

  let posts;
  if (v.loading && !v.posts.length) posts = <p className="pv__empty">Loading discussions…</p>;
  else if (!v.posts.length && searchingPosts) posts = <p className="pv__empty">No posts match your search.</p>;
  else if (!v.posts.length) posts = <p className="pv__empty">No discussions yet — start the first one!</p>;
  else posts = <div className={`gpost-list${v.loading ? " is-loading" : ""}`}>{v.posts.map((post) => <PostItem key={post.id} post={post} />)}</div>;

  const sortBy = (sort) => { setGroupView({ sort }); loadGroupPosts(true); };
  const topPerfumes = (g.topPerfumes || []).filter((t) => byId(t.slug));

  return (
    <div className="container pv">
      <Crumbs>
        <span><a className="link" href="#groups">Groups</a> / <strong>{g.name}</strong></span>
      </Crumbs>

      <section className="group-head">
        <GroupIcon g={g} size="group-icon--lg" />
        <div className="group-head__info">
          <h1 className="group-head__name">{g.name}</h1>
          <p className="group-head__desc">{g.description}</p>
          <p className="group-head__meta">
            <strong data-members-of={g.slug}>{formatCount(g.members)}</strong>{" members · "}
            <strong>{formatCount(g.posts)}</strong>{" discussions · "}
            <strong>{formatCount(g.postsThisWeek)}</strong> posts this week
          </p>
        </div>
        <div className="group-head__actions"><JoinButton g={g} extra="btn--follow-lg" />{isCreator ? <CreatorActions g={g} v={v} /> : null}</div>
      </section>

      <div className="pv__grid">
        <div className="pv__main">
          <section className="panel">
            {writeArea}
            <div className="panel__head">
              <h2 className="panel__title">Discussions</h2>
              <div className="segmented" role="tablist" aria-label="Sort posts">
                <button role="tab" aria-selected={String(v.sort === "new")} data-posts-sort="new" onClick={() => sortBy("new")}>Newest</button>
                <button role="tab" aria-selected={String(v.sort === "top")} data-posts-sort="top" onClick={() => sortBy("top")}>Top</button>
              </div>
            </div>
            <div className="filter-fields" role="search" aria-label="Search posts">
              <label className="filter-field filter-field--wide">
                <span>Search posts</span>
                <input id="postsQuery" type="search" value={v.q} placeholder="Words or @member" autoComplete="off" onChange={(e) => setPostsQuery(e.target.value)} />
              </label>
              <label className="filter-field">
                <span>Date</span>
                <select id="postsSince" value={v.since} onChange={(e) => { setGroupView({ since: e.target.value }); loadGroupPosts(true); }}>
                  {SINCE.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </label>
            </div>
            {posts}
            {v.hasMore ? (
              <div className="all-reviews__more">
                <button className="btn btn--ghost" data-posts-more="" disabled={v.loading} onClick={() => loadGroupPosts(false)}>{v.loading ? "Loading…" : "Load more"}</button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="pv__side">
          <section className="panel">
            <h2 className="panel__title">About</h2>
            <p className="group-about">{g.description}</p>
            <ul className="group-facts">
              {familyName ? <li><span>Scent family</span><strong>{familyName}</strong></li> : null}
              <li><span>Created</span><strong>{g.createdBy ? <>{`${created} by `}<MemberLink user={g.createdBy}>{`@${g.createdBy.username}`}</MemberLink></> : created}</strong></li>
              <li><span>Posts &amp; replies</span><strong>{formatCount(g.messages)}</strong></li>
            </ul>
          </section>

          {g.topPerfumes && g.topPerfumes.length ? (
            <section className="panel">
              <h2 className="panel__title">Most discussed perfumes</h2>
              <ul className="group-perfumes">
                {topPerfumes.map((t) => {
                  const p = byId(t.slug);
                  return <li key={t.slug}><a href={`#perfume/${p.id}`}><PerfumeMedia p={p} size="xs" /><span><strong>{p.name}</strong><span>{p.brand}</span></span></a><span className="group-perfumes__n">{t.mentions}</span></li>;
                })}
              </ul>
            </section>
          ) : null}

          <section className="panel">
            <h2 className="panel__title">New members</h2>
            <ul className="reviewers">
              {(g.recentMembers || []).length ? g.recentMembers.map((u) => (
                <li className="reviewer" key={u.username}>
                  <AvatarLink user={u} size="avatar--sm" />
                  <div><p className="reviewer__name"><MemberLink user={u} /></p><p className="reviewer__meta">{`@${u.username}`}</p></div>
                </li>
              )) : <li className="activity__empty">No members yet.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
