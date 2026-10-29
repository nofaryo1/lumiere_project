import React, { useEffect } from "react";
import $ from "jquery";
import { app } from "../../store/app";
import { chat } from "../../store/chat";
import { openAuth, setNav } from "../../store/ui";
import { logout, rememberedAccount } from "../../store/session";
import { Icon, LockIcon } from "../common/Icon";
import { Avatar } from "../common/Avatar";
import { SearchBox } from "../search/SearchBox";

const unreadText = (n) => (n > 99 ? "99+" : String(n));

function NavLink({ href, label, member, children, extra }) {
  const locked = !member;
  const onClick = (e) => {
    if (!locked) return;
    e.preventDefault();
    openAuth("signup", `Join the community to use ${label}.`);
  };
  return (
    <a href={href} className={`nav__link${locked ? " is-locked" : ""}`} aria-disabled={locked ? "" : undefined}
       title={locked ? "Join the community to unlock" : ""} data-members-only="" {...extra} onClick={onClick}>
      <LockIcon />{children ? `${label} ` : label}{children}
    </a>
  );
}

function AccountMenu({ user }) {
  const { nav } = app.use();
  const profileHref = `#profile/${encodeURIComponent(user.username)}`;

  // a click outside the menu, or on one of its links, closes it
  useEffect(() => {
    const close = (e) => {
      if (!app.state.nav.menuOpen || $(e.target).closest("#accountBtn").length) return;
      if (!$(e.target).closest("#accountMenu").length || $(e.target).closest("a, button").length) setNav({ menuOpen: false });
    };
    $(document).on("click", close);
    return () => $(document).off("click", close);
  }, []);

  return (
    <div className="account">
      <button className="account__btn" id="accountBtn" aria-expanded={String(nav.menuOpen)} aria-haspopup="menu" aria-controls="accountMenu"
              onClick={() => setNav({ menuOpen: !nav.menuOpen })}>
        <Avatar user={user} size="avatar--sm" />
        <span className="account__name">{user.displayName.split(" ")[0]}</span>
        <Icon name="chevron" />
      </button>{" "}
      <div className="account__menu" id="accountMenu" role="menu" hidden={!nav.menuOpen}>
        <p className="account__who"><strong>{user.displayName}</strong><span>{`@${user.username}`}</span></p>
        <a role="menuitem" href={profileHref}>My profile</a>
        <a role="menuitem" href="#add-perfume">Add a perfume</a>
        <button role="menuitem" data-logout="" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}

export function Header() {
  const { ready, session, nav } = app.use();
  const { unread } = chat.use();
  // until the server answers, paint the header for the member who was logged in last time
  const user = ready ? session.user : rememberedAccount();
  const member = !!user;

  return (
    <header className="header">
      <div className="container header__inner">
        <a href="/" className="logo" aria-label="LUMIERE home">
          <span className="logo__mark" aria-hidden="true" />
          LUMIERE
        </a>

        <SearchBox />

        <nav className={`nav${nav.open ? " is-open" : ""}`} id="nav" aria-label="Main navigation"
             onClick={(e) => { if (e.target.closest("a")) setNav({ open: false }); }}>
          <a href="/" className="nav__link is-active" aria-current="page">Home</a>{" "}
          <NavLink href="#trending" label="Discover" member={member} />{" "}
          <NavLink href="#groups" label="Community" member={member} />{" "}
          <NavLink href="#reviews" label="Reviews" member={member} />{" "}
          <NavLink href="#messages" label="Messages" member={member} extra={{ "data-messages-link": "" }}>
            <span className="badge" hidden={!unread}>{unreadText(unread)}</span>
          </NavLink>{" "}
          <div className="nav__auth-mobile" id="navAuthMobile">
            {!ready ? null : session.user ? (
              <>
                <a className="btn btn--ghost" href={`#profile/${encodeURIComponent(session.user.username)}`}>My profile</a>{" "}
                <a className="btn btn--primary" href="#add-perfume">Add a perfume</a>{" "}
                <button className="btn btn--ghost nav__logout" data-logout="" onClick={logout}>Log out</button>
              </>
            ) : (
              <>
                <button className="btn btn--ghost" data-auth="login" onClick={() => openAuth("login")}>Log in</button>{" "}
                <button className="btn btn--primary" data-auth="signup" onClick={() => openAuth("signup")}>Sign up</button>
              </>
            )}
          </div>
        </nav>

        <div className="header__actions">
          <div className="header__account" id="headerAccount">
            {user ? <AccountMenu user={user} /> : (
              <>
                <button className="btn btn--ghost btn--sm header__login" data-auth="login" onClick={() => openAuth("login")}>Log in</button>
                <button className="btn btn--primary btn--sm header__signup" data-auth="signup" onClick={() => openAuth("signup")}>Sign up</button>
              </>
            )}
          </div>
          <button className="icon-btn nav-toggle" id="navToggle" aria-label={nav.open ? "Close menu" : "Open menu"} aria-expanded={String(nav.open)} aria-controls="nav"
                  onClick={() => setNav({ open: !nav.open })}>
            <Icon name="menu" />
            <span className="badge nav-toggle__badge" data-unread-badge="" aria-hidden="true" hidden={!unread}>{unreadText(unread)}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
