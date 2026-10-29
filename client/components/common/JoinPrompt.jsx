import React from "react";
import { openAuth } from "../../store/ui";

export function JoinPrompt({ children }) {
  return (
    <div className="join-prompt">
      <p>{children}</p>
      <div className="join-prompt__actions">
        <button className="btn btn--primary btn--sm" data-auth="signup" onClick={() => openAuth("signup")}>Join the community</button>
        <button className="btn btn--ghost btn--sm" data-auth="login" onClick={() => openAuth("login")}>Log in</button>
      </div>
    </div>
  );
}
