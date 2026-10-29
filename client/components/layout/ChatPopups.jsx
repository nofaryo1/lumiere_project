import React from "react";
import { chat, dismissPopup } from "../../store/chat";
import { Avatar } from "../common/Avatar";
import { Icon } from "../common/Icon";

// New-message notices in the corner while the messenger isn't open on that chat
export function ChatPopups() {
  const { popups } = chat.use();
  return (
    <div className="chat-popups" id="chatPopups" aria-live="polite">
      {popups.map((p) => (
        <a key={p.id} className={`chat-popup${p.leaving ? " is-leaving" : ""}`} href={`#messages/${encodeURIComponent(p.other.username)}`} role="status"
           onClick={(e) => { if (e.target.closest(".chat-popup__close")) e.preventDefault(); dismissPopup(p.id); }}>
          <Avatar user={p.other} />
          <span className="chat-popup__body">
            <strong>{p.other.displayName}</strong>
            <span>{p.text.length > 90 ? p.text.slice(0, 89) + "…" : p.text}</span>
          </span>
          <button className="chat-popup__close" aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </a>
      ))}
    </div>
  );
}
