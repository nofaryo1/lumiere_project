import { React } from "../shared/react";
import { app } from "../shared/lumiere";

export function Avatar({ user }) {
  const a = app.avatarFor(user);
  return (
    <span className="avatar" style={{ "--avatar-bg": a.bg, "--avatar-fg": a.fg }} aria-hidden="true">
      {a.initials}
    </span>
  );
}
