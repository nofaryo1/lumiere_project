import React from "react";

export function PanelHeader() {
  return (
    <div className="panel__head">
      <h2 className="panel__title">Top reviewers</h2>
      <span className="panel__meta">{new Date().toLocaleDateString("en-US", { month: "long" })}</span>
    </div>
  );
}
