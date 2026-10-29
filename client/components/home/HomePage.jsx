import React, { useLayoutEffect } from "react";
import { app } from "../../store/app";
import { memberGuess } from "../../store/session";
import { VideoBanner } from "../video/VideoBanner";
import { Hero } from "./Hero";
import { Trending } from "./Trending";
import { Community } from "./Community";
import { GroupsTeaser } from "./GroupsTeaser";
import { TrendsChart } from "../stats/TrendsChart";
import { GroupChart } from "../stats/GroupChart";

const STEADY_IDS = ["filterBar", "trendingGrid", "reviewList", "activityFeed", "topReviewersRoot", "groupsTeaser", "trendsChart", "groupChart"];

// On refresh, the home sections start at the heights they had last time, so the restored
// scroll position doesn't jump while their data loads
function useSteadyLayout() {
  useLayoutEffect(() => {
    const save = () => {
      if (app.state.view) return;
      const heights = {};
      STEADY_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el && !el.style.minHeight) heights[id] = Math.round(el.offsetHeight);
      });
      try {
        sessionStorage.setItem("lumiere:layout", JSON.stringify({ w: window.innerWidth, member: !!app.state.session.user, heights }));
      } catch (err) {}
    };
    window.addEventListener("pagehide", save);

    let saved = null;
    if (!document.documentElement.classList.contains("is-opening-view")) {
      try { saved = JSON.parse(sessionStorage.getItem("lumiere:layout")); } catch (err) {}
    }
    if (!saved || saved.w !== window.innerWidth || saved.member !== memberGuess()) return () => window.removeEventListener("pagehide", save);

    const reserved = Object.keys(saved.heights).map((id) => {
      const el = document.getElementById(id);
      if (el) el.style.minHeight = saved.heights[id] + "px";
      return el;
    }).filter(Boolean);

    let quiet;
    let cap;
    const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(release, 700); });
    function release() {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(cap);
      reserved.forEach((el) => { el.style.minHeight = ""; });
    }
    reserved.forEach((el) => observer.observe(el, { childList: true, subtree: true }));
    quiet = setTimeout(release, 700);
    cap = setTimeout(release, 6000);
    return () => { window.removeEventListener("pagehide", save); release(); };
  }, []);
}

export function HomePage({ hidden }) {
  useSteadyLayout();
  return (
    <main hidden={hidden}>
      <section className="video-section" aria-label="Welcome video">
        <div className="container" id="videoBannerRoot"><VideoBanner /></div>
      </section>

      <Hero />
      <Trending />
      <Community />
      <GroupsTeaser />

      <section className="section section--alt" id="insights">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 className="section-title">Review trends</h2>
              <p className="section-sub">Total reviews per perfume over the past year — the line on top is the most reviewed perfume at that moment</p>
            </div>
          </div>
          <TrendsChart />
        </div>
      </section>

      <section className="section" id="group-activity">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 className="section-title">Group activity</h2>
              <p className="section-sub">Posts per month in the most active discussion groups over the past year</p>
            </div>
            <a href="#groups" className="link">Browse groups</a>
          </div>
          <GroupChart />
        </div>
      </section>
    </main>
  );
}
