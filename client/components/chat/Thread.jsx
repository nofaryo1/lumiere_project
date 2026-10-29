import React, { useEffect, useLayoutEffect, useRef } from "react";
import { app } from "../../store/app";
import { chat, isOnline, loadMessages, sendChat, sendTyping } from "../../store/chat";
import { dayLabel, fmtTime } from "../../lib/format";
import { Avatar } from "../common/Avatar";
import { Icon } from "../common/Icon";

function ThreadStatus({ active, typingUntil }) {
  if (typingUntil > Date.now()) return <span className="thread__typing">typing<span className="dots"><span>.</span><span>.</span><span>.</span></span></span>;
  return isOnline(active.other.username) ? <span className="thread__online">Online</span> : "Offline";
}

function Messages() {
  const { active, thread, loading, scroll } = chat.use();
  const me = app.state.session.user.username;
  const boxRef = useRef(null);
  const atBottom = useRef(true);

  // keep the newest message in view, or the same messages when earlier ones load on top
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (scroll.mode === "older") box.scrollTop = box.scrollHeight - scroll.prevHeight;
    else if (scroll.mode === "end" || atBottom.current) box.scrollTop = box.scrollHeight;
    atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  }, [scroll.seq]);

  const msgs = thread.messages;
  const lastMine = [...msgs].reverse().find((m) => m.sender === me);
  const rows = [];
  let lastDay = "";
  msgs.forEach((m, i) => {
    const day = dayLabel(m.createdAt);
    if (day !== lastDay) { rows.push(<p className="thread__day" key={`d${i}`}><span>{day}</span></p>); lastDay = day; }
    const mine = m.sender === me;
    const next = msgs[i + 1];
    const grouped = next && next.sender === m.sender && new Date(next.createdAt) - new Date(m.createdAt) < 5 * 60 * 1000;
    rows.push(
      <div className={`bubble-row${mine ? " bubble-row--mine" : ""}${grouped ? " is-grouped" : ""}`} key={m.clientId || m.id}>
        <div className={`bubble${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}`}>
          <p>{m.text}</p>
          <span className="bubble__time">{fmtTime(m.createdAt)}</span>
        </div>
      </div>,
    );
    if (m === lastMine) {
      const status = m.failed ? <span className="is-failed">Not sent</span> : m.pending ? "Sending…" : m.readAt ? "Seen" : "Sent";
      rows.push(<p className="bubble-status" key="status">{status}</p>);
    }
  });

  return (
    <div className="thread__messages" id="threadMessages" aria-live="polite" ref={boxRef}
         onScroll={(e) => { const b = e.currentTarget; atBottom.current = b.scrollHeight - b.scrollTop - b.clientHeight < 80; }}>
      {thread.hasMore ? (
        <div className="thread__older"><button className="link link--btn" data-older="" disabled={loading} onClick={() => loadMessages(true)}>{loading ? "Loading…" : "Load earlier messages"}</button></div>
      ) : null}
      {!msgs.length && thread.loaded && !loading
        ? <p className="thread__start">This is the start of your conversation with <strong>{active.other.displayName}</strong>. Say hi 👋</p>
        : null}
      {rows}
    </div>
  );
}

function autosize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(140, textarea.scrollHeight)}px`;
}

function Composer() {
  const { focusSeq } = chat.use();
  const ref = useRef(null);

  useEffect(() => {
    if (focusSeq && ref.current && window.matchMedia("(min-width: 681px)").matches) ref.current.focus();
  }, [focusSeq]);

  const send = () => {
    const box = ref.current;
    if (sendChat(box.value)) { box.value = ""; autosize(box); }
  };

  return (
    <form className="thread__composer" id="chatForm" autoComplete="off" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <textarea name="text" rows="1" maxLength="2000" placeholder="Write a message…" aria-label="Write a message" ref={ref}
                onInput={(e) => { autosize(e.currentTarget); sendTyping(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
      <button className="btn btn--primary" type="submit" aria-label="Send">
        <Icon name="send" />
      </button>
    </form>
  );
}

export function Thread() {
  const { active, typingUntil, connected } = chat.use();
  return (
    <>
      <header className="thread__head">
        <a className="thread__back" href="#messages" aria-label="Back to conversations">
          <Icon name="back" />
        </a>
        <a className="thread__who" href={`#profile/${encodeURIComponent(active.other.username)}`}>
          <span className="conv__avatar"><Avatar user={active.other} /><span className="online-dot" id="threadAvatarDot" hidden={!isOnline(active.other.username)} /></span>
          <span><strong>{active.other.displayName}</strong><span className="thread__status" id="threadStatus"><ThreadStatus active={active} typingUntil={typingUntil} /></span></span>
        </a>
      </header>
      <Messages />
      <p className="thread__note" id="connectionNote" hidden={connected}>{connected ? "" : "Reconnecting to live chat…"}</p>
      <Composer />
    </>
  );
}
