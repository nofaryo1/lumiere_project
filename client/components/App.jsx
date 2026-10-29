import React, { useEffect, useLayoutEffect } from "react";
import $ from "jquery";
import { api } from "../lib/api";
import { app, byId } from "../store/app";
import { chat, startMessenger } from "../store/chat";
import { loadCatalog, syncNewPerfumes } from "../store/catalog";
import { refreshCommunity } from "../store/community";
import { loadGroups } from "../store/groups";
import { route, flushAfterRender } from "../store/router";
import { setSession, memberGuess } from "../store/session";
import { closeAuth, setNav } from "../store/ui";
import { Header } from "./layout/Header";
import { Footer } from "./layout/Footer";
import { AuthModal } from "./layout/AuthModal";
import { ChatPopups } from "./layout/ChatPopups";
import { Toast } from "./common/Toast";
import { Crumbs } from "./common/BackButton";
import { HomePage } from "./home/HomePage";
import { PerfumePage } from "./perfume/PerfumePage";
import { PerfumeForm } from "./perfume/PerfumeForm";
import { ProfilePage } from "./profile/ProfilePage";
import { AllReviewsPage } from "./reviews/AllReviewsPage";
import { MembersPage } from "./members/MembersPage";
import { GroupsPage } from "./groups/GroupsPage";
import { GroupPage } from "./groups/GroupPage";
import { GroupForm } from "./groups/GroupForm";
import { MessengerPage } from "./chat/MessengerPage";
import { AboutPage, HelpPage, PrivacyPage } from "./info/InfoPages";

async function start() {
  const [me, list] = await Promise.allSettled([api("/auth/me"), loadCatalog()]);
  setSession(me.status === "fulfilled" ? me.value : null);
  app.state.perfumesFailed = list.status === "rejected";
  app.update({ ready: true });

  refreshCommunity();
  loadGroups();
  startMessenger();

  $(window).on("hashchange", route);
  route();
}

function MessagesView() {
  const { pageSeq } = chat.use();
  return <MessengerPage key={pageSeq} />;
}

function NotFound() {
  return <div className="container pv"><Crumbs label={false} /><p className="pv__empty">This perfume doesn't exist (anymore).</p></div>;
}

function View({ view }) {
  switch (view.name) {
    case "perfume": { const p = byId(view.id); return p ? <PerfumePage p={p} /> : null; }
    case "perfume-form": return <PerfumeForm id={view.id} />;
    case "profile": return <ProfilePage view={view} />;
    case "all-reviews": return <AllReviewsPage />;
    case "members": return <MembersPage />;
    case "groups": return <GroupsPage />;
    case "group": return <GroupPage />;
    case "group-form": return <GroupForm slug={view.slug} />;
    case "messages": return <MessagesView />;
    case "about": return <AboutPage />;
    case "privacy": return <PrivacyPage />;
    case "help": return <HelpPage />;
    default: return <NotFound />;
  }
}

function onKeyDown(e) {
  if (e.key !== "Escape") return;
  const { auth, nav, view } = app.state;
  if (auth.open) { closeAuth(); return; }
  if (nav.menuOpen) { setNav({ menuOpen: false }); $("#accountBtn").trigger("focus"); }
  if (nav.open) setNav({ open: false });
  if (view && !$(e.target).closest("input, select, textarea").length) location.hash = "";
}

// Guests see perfumes other members added while the tab was in the background
function onVisibility() {
  if (document.visibilityState === "visible" && !app.state.session.user && app.state.perfumes.length) syncNewPerfumes();
}

export function App() {
  const { view, ready } = app.use();

  useEffect(() => {
    start();
    $(document).on("keydown", onKeyDown);
    $(document).on("visibilitychange", onVisibility);
    return () => {
      $(document).off("keydown", onKeyDown);
      $(document).off("visibilitychange", onVisibility);
    };
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("is-member", memberGuess());
  });
  useLayoutEffect(flushAfterRender);

  return (
    <>
      <Header />
      <HomePage hidden={!!view} />
      <div className="perfume-view" id="perfumeView" hidden={!view}>
        {view ? <View key={view.seq} view={view} /> : null}
      </div>
      <Footer />
      <AuthModal />
      <ChatPopups />
      <Toast />
    </>
  );
}
