import React, { useEffect, useRef, useState } from "react";
import { app, byId } from "../../store/app";
import { setProfileTab, setProfileMode } from "../../store/profile";
import { deleteAccount, logout, saveProfile, isMe } from "../../store/session";
import { openAuth, toast } from "../../store/ui";
import { formatCount, timeAgo } from "../../lib/format";
import { Crumbs } from "../common/BackButton";
import { Avatar } from "../common/Avatar";
import { FollowButton } from "../common/FollowButton";
import { HelpfulButton } from "../common/HelpfulButton";
import { MemberRow } from "../common/MemberRow";
import { PerfumeCard } from "../common/PerfumeCard";
import { PerfumeMedia } from "../common/PerfumeMedia";
import { Stars } from "../common/Stars";
import { FieldError } from "../layout/FieldError";
import { GroupCard } from "../groups/GroupCard";

function ProfileReview({ review: rv }) {
  const p = byId(rv.perfume);
  if (!p) return null;
  return (
    <article className="profile-review">
      <a href={`#perfume/${p.id}`} className="profile-review__perfume">
        <PerfumeMedia p={p} size="sm" />
        <span>
          <span className="profile-review__name">{p.name}</span>
          <span className="profile-review__brand">{p.brand}</span>
        </span>
      </a>
      <div className="profile-review__body">
        <div className="profile-review__meta"><Stars rating={rv.rating} /><strong>{`${rv.rating}.0`}</strong><span>{`· ${timeAgo(rv.updatedAt || rv.createdAt)}`}</span></div>
        <p>{rv.text}</p>
        <div className="profile-review__actions"><HelpfulButton review={rv} /></div>
      </div>
    </article>
  );
}

function EditForm({ user }) {
  const [errors, setErrors] = useState({});
  const formRef = useRef(null);
  useEffect(() => { formRef.current.querySelector("input").focus(); }, []);
  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await saveProfile({ displayName: form.displayName.value, bio: form.bio.value });
    } catch (err) {
      setErrors((err.data && err.data.fields) || {});
      toast(err.message);
    }
  };
  return (
    <form className="profile-edit" id="profileForm" noValidate ref={formRef} onSubmit={onSubmit}>
      <label className="field">
        <span className="field__label">Name</span>
        <input name="displayName" maxLength="40" defaultValue={user.displayName} required aria-invalid={errors.displayName ? "" : undefined} />
        <FieldError name="displayName" errors={errors} />
      </label>
      <label className="field">
        <span className="field__label">Bio <span className="field__optional">(optional)</span></span>
        <textarea name="bio" rows="2" maxLength="160" placeholder="What do you love to wear?" defaultValue={user.bio} aria-invalid={errors.bio ? "" : undefined} />
      </label>
      <div className="profile-edit__actions">
        <button type="button" className="btn btn--ghost btn--sm" data-cancel-profile="" onClick={() => setProfileMode({ editing: false, deleting: false })}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--sm">Save</button>
      </div>
    </form>
  );
}

function DeleteBox() {
  const { profile } = app.use();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { if (profile.deleting) inputRef.current.focus(); }, [profile.deleting]);

  if (!profile.deleting) {
    return <p className="profile-edit__danger"><button type="button" className="link link--btn is-danger" data-delete-account="" onClick={() => setProfileMode({ deleting: true })}>Delete account</button></p>;
  }
  const confirm = async () => {
    const password = inputRef.current.value;
    if (!password) { setError("Please enter your password."); return; }
    setBusy(true);
    try {
      await deleteAccount(password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="account-delete" role="group" aria-label="Delete your account">
      <div>
        <strong>Delete your account?</strong>
        <p>This permanently removes your profile, reviews, likes, follows, group posts and messages. Perfumes and groups you created stay on LUMIERE.</p>
      </div>
      <label className="field">
        <span className="field__label">Enter your password to confirm</span>
        <input type="password" id="deleteAccountPassword" autoComplete="current-password" ref={inputRef} />
        <span className="field__error" id="deleteAccountError">{error}</span>
      </label>
      <div className="profile-edit__actions">
        <button type="button" className="btn btn--ghost btn--sm" data-cancel-delete-account="" onClick={() => setProfileMode({ deleting: false })}>Cancel</button>
        <button type="button" className="btn btn--danger btn--sm" data-confirm-delete-account="" disabled={busy} onClick={confirm}>Delete my account</button>
      </div>
    </div>
  );
}

function TabContent({ data, tab, list, me, liked, added }) {
  const { groups } = app.use();
  const { user, reviews } = data;
  const who = me ? "You haven't" : `${user.displayName} hasn't`;
  if (tab === "liked") {
    return liked.length
      ? <div className="perfume-grid">{liked.map((p) => <PerfumeCard key={p.id} p={p} />)}</div>
      : <p className="pv__empty">{`${who} liked any perfumes yet.${me ? " Tap the ♥ on a perfume to save it here." : ""}`}</p>;
  }
  if (tab === "reviews") {
    return reviews.length
      ? <div className="profile-reviews">{reviews.map((rv) => <ProfileReview key={rv.id} review={rv} />)}</div>
      : <p className="pv__empty">{`${who} written any reviews yet.${me ? " Open a perfume and tap “Write a review”." : ""}`}</p>;
  }
  if (tab === "groups") {
    const full = (data.groups || []).map((g) => (groups.list || []).find((x) => x.slug === g.slug) || { ...g, description: "", members: 0, postsThisWeek: 0 });
    return full.length
      ? <div className="group-grid">{full.map((g) => <GroupCard key={g.slug} g={g} />)}</div>
      : <p className="pv__empty">{`${who} joined any groups yet.${me ? " " : ""}`}{me ? <a className="link" href="#groups">Browse groups</a> : null}</p>;
  }
  if (tab === "added") {
    return added.length
      ? <div className="perfume-grid">{added.map((p) => <PerfumeCard key={p.id} p={p} owner={me} />)}</div>
      : <p className="pv__empty">{`${who} added any perfumes yet.${me ? " " : ""}`}{me ? <a className="link" href="#add-perfume">Add a perfume</a> : null}</p>;
  }
  const label = tab === "followers" ? "followers" : "people they follow";
  if (!list || list.kind !== tab) return <p className="pv__empty">Loading…</p>;
  if (!list.users.length) {
    return (
      <p className="pv__empty">{tab === "followers"
        ? `${me ? "You don't" : `${user.displayName} doesn't`} have any followers yet.`
        : `${me ? "You aren't" : `${user.displayName} isn't`} following anyone yet.`}</p>
    );
  }
  return (
    <>
      <ul className="member-list">{list.users.map((u) => <MemberRow key={u.username} user={u} />)}</ul>
      {list.total > list.users.length ? <p className="pv__hint">{`Showing the ${list.users.length} most recent of ${list.total.toLocaleString("en-US")} ${label}.`}</p> : null}
    </>
  );
}

export function ProfilePage({ view }) {
  const { profile, session } = app.use();
  if (view.loading || view.error) {
    return (
      <div className="container pv">
        {view.error ? <><Crumbs label={false} /><p className="pv__empty">{view.error}</p></> : <p className="pv__empty">Loading profile…</p>}
      </div>
    );
  }
  const data = profile.data;
  const { user, likes, reviews } = data;
  const me = isMe(user.username);
  const liked = likes.map(byId).filter(Boolean);
  const added = data.added.map(byId).filter(Boolean);
  const joined = new Date(user.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const tab = profile.tab;

  const tabs = [
    ["liked", "Liked", liked.length],
    ["reviews", "Reviews", reviews.length],
    ["added", "Added", added.length],
    ["groups", "Groups", (data.groups || []).length],
    ["followers", "Followers", data.followers],
    ["following", "Following", data.following],
  ];
  const stat = (key, n, label) => (
    <button className="profile-stat" data-profile-tab={key} onClick={() => setProfileTab(key)}><strong>{formatCount(n)}</strong><span>{label}</span></button>
  );

  return (
    <div className="container pv">
      <Crumbs>
        <span>Members / <strong>{`@${user.username}`}</strong></span>
      </Crumbs>

      <section className="profile-head">
        <Avatar user={user} size="avatar--xl" />
        <div className="profile-head__info">
          {me && profile.editing ? <><EditForm user={user} /><DeleteBox /></> : (
            <>
              <h1 className="profile-head__name">{user.displayName}</h1>
              <p className="profile-head__meta">{`@${user.username} · Joined ${joined}`}</p>
              {user.bio ? <p className="profile-head__bio">{user.bio}</p> : null}
            </>
          )}
          <div className="profile-head__stats">
            {stat("followers", data.followers, "Followers")}
            {stat("following", data.following, "Following")}
            {stat("reviews", reviews.length, "Reviews")}
            {stat("liked", liked.length, "Liked")}
          </div>
        </div>
        <div className="profile-head__actions">
          {me ? (profile.editing ? null : (
            <>
              <button className="btn btn--ghost btn--sm" data-edit-profile="" onClick={() => setProfileMode({ editing: true })}>Edit profile</button>
              <a className="btn btn--primary btn--sm" href="#add-perfume">Add a perfume</a>
              <button className="btn btn--ghost btn--sm" data-logout="" onClick={logout}>Log out</button>
            </>
          )) : (
            <>
              <FollowButton username={user.username} extra="btn--follow-lg" />
              {session.user
                ? <a className="btn btn--ghost btn--follow-lg" href={`#messages/${encodeURIComponent(user.username)}`}>Message</a>
                : <button className="btn btn--ghost btn--follow-lg" data-auth="signup" data-reason="Join the community to message other members." onClick={() => openAuth("signup", "Join the community to message other members.")}>Message</button>}
            </>
          )}
        </div>
      </section>{" "}

      <div className="segmented profile-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map(([key, label, n]) => (
          <button key={key} role="tab" aria-selected={String(tab === key)} data-profile-tab={key} onClick={() => setProfileTab(key)}>{`${label} `}<span className="tab-count">{formatCount(n)}</span></button>
        ))}
      </div>{" "}

      <div className="profile-content"><TabContent data={data} tab={tab} list={profile.list} me={me} liked={liked} added={added} /></div>
    </div>
  );
}
