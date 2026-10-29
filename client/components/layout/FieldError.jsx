import React from "react";

// The red line under a form field
export function FieldError({ name, errors }) {
  return <span className="field__error" data-error-for={name}>{(errors && errors[name]) || ""}</span>;
}
