import React from "react";
import { app } from "../../store/app";
import { openAuth } from "../../store/ui";
import { runSearch } from "../../store/trending";
import { SearchBox } from "../search/SearchBox";
import { Avatar } from "../common/Avatar";

const POPULAR = [["vanilla", "Vanilla"], ["woody", "Woody"], ["fresh", "Fresh for summer"], ["musk", "Clean musk"], ["rose", "Rose"]];

function Snapshot() {
  const { ready, session, community } = app.use();
  return (
    <aside className={`snapshot${ready ? "" : " is-pending"}`} id="snapshot" aria-label="Community snapshot" aria-busy={ready ? undefined : "true"} hidden={ready && !!session.user}>
      <div className="snapshot__head">
        <span className="live-dot" aria-hidden="true" />
        <span>Live in the community</span>
      </div>
      <div className="snapshot__welcome" id="snapshotWelcome">
        <p className="snapshot__title">Welcome to LUMIERE 👋</p>
        <p>Want to chat with other fragrance lovers and share your opinion in reviews? Join the community — it only takes a minute.</p>
      </div>
      <div className="snapshot__online">
        <div className="avatar-stack" id="onlineAvatars">{community.online.map((u) => <Avatar key={u.username} user={u} />)}</div>
        <p><strong>214</strong> people online now</p>
      </div>
      <div id="snapshotCta">
        <button className="btn btn--primary btn--block" data-auth="signup" onClick={() => openAuth("signup")}>Join the community — it’s free</button>
      </div>
    </aside>
  );
}

export function Hero() {
  const { ready, session } = app.use();
  const solo = ready && !!session.user;
  return (
    <section className={`hero${solo ? " hero--solo" : ""}`} id="search">
      <div className="container hero__grid">
        <div className="hero__main">
          <h1 className="hero__title">Find your next favorite fragrance</h1>
          <p className="hero__subtitle">Real reviews from real people. Search thousands of perfumes, compare notes, and see what the community is wearing.</p>

          <SearchBox hero />

          <div className="hero__popular">
            <span>Popular:</span>
            {POPULAR.map(([q, label]) => <button key={q} className="tag" data-query={q} onClick={() => runSearch(q)}>{label}</button>)}
          </div>
        </div>

        <Snapshot />
      </div>
    </section>
  );
}
