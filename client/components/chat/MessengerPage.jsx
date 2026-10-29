import React, { useEffect } from "react";
import $ from "jquery";
import { chat, onVisible } from "../../store/chat";
import { MemberSearch } from "./MemberSearch";
import { ConversationList } from "./ConversationList";
import { Thread } from "./Thread";

export function MessengerPage() {
  const { active, opening } = chat.use();

  // coming back to the tab marks the open chat as read
  useEffect(() => {
    $(document).on("visibilitychange", onVisible);
    return () => $(document).off("visibilitychange", onVisible);
  }, []);

  let thread = null;
  if (active) thread = <Thread key={active.id} />;
  else if (!opening) {
    thread = (
      <div className="thread__empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" /></svg>
        <p><strong>Your messages</strong></p>
        <p>Pick a conversation, or search for a member to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="container pv messenger-page">
      <div className={`messenger${active || opening ? " messenger--thread" : ""}`}>
        <aside className="messenger__list">
          <div className="messenger__head"><h1>Messages</h1></div>
          <MemberSearch />
          <ConversationList />
        </aside>
        <section className="messenger__thread">{thread}</section>
      </div>
    </div>
  );
}
