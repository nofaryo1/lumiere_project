import React from "react";
import { chat, isOnline, prefetchConversationWith } from "../../store/chat";
import { timeAgo } from "../../lib/format";
import { Avatar } from "../common/Avatar";

function ConversationItem({ c, active }) {
  const last = c.lastMessage;
  return (
    <li>
      <a className={`conv${active ? " is-active" : ""}${c.unread ? " is-unread" : ""}`} href={`#messages/${encodeURIComponent(c.other.username)}`}
         onPointerOver={() => prefetchConversationWith(c.other.username)}>
        <span className="conv__avatar"><Avatar user={c.other} />{isOnline(c.other.username) ? <span className="online-dot" aria-label="Online" /> : null}</span>
        <span className="conv__body">
          <span className="conv__top"><strong>{c.other.displayName}</strong><span>{last ? timeAgo(last.at) : ""}</span></span>
          <span className="conv__last">{last ? `${last.mine ? "You: " : ""}${last.text}` : "No messages yet"}</span>
        </span>
        {c.unread ? <span className="badge conv__badge">{c.unread}</span> : null}
      </a>
    </li>
  );
}

export function ConversationList() {
  const { conversations, active } = chat.use();
  let body;
  if (!conversations) body = <li className="conv-empty">Loading…</li>;
  else if (!conversations.length) body = <li className="conv-empty">No conversations yet. Search for a member above, or tap <strong>Message</strong> on someone's profile.</li>;
  else body = conversations.map((c) => <ConversationItem key={c.id} c={c} active={!!active && String(active.id) === String(c.id)} />);
  return <ul className="conv-list" id="convList">{body}</ul>;
}
