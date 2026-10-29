import React from "react";
import { Icon } from "./Icon";
import { goBack } from "../../store/router";

export function BackButton() {
  return <button className="pv__back" data-back="" onClick={goBack}><Icon name="back" /> Back</button>;
}

export function Crumbs({ children, label = true }) {
  return (
    <nav className="pv__crumbs" aria-label={label ? "Breadcrumb" : undefined}>
      <BackButton />
      {children}
    </nav>
  );
}
