import React from "react";
import { app } from "../../store/app";

export function Toast() {
  const { toast } = app.use();
  return <div className="toast" id="toast" role="status" aria-live="polite" hidden={!toast.visible}>{toast.text}</div>;
}
