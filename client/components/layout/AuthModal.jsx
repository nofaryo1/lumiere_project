import React, { useEffect, useRef, useState } from "react";
import { app } from "../../store/app";
import { closeAuth, openAuth } from "../../store/ui";
import { submitAuth } from "../../store/session";
import { Icon } from "../common/Icon";
import { FieldError } from "./FieldError";

function Field({ name, label, type, autoComplete, hint, errors }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <input name={name} type={type} autoComplete={autoComplete} required minLength={type === "password" ? 8 : undefined}
             aria-invalid={errors[name] ? "" : undefined} />
      <FieldError name={name} errors={errors} />
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

function AuthForm({ signup }) {
  const formRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { formRef.current.querySelector("input").focus(); }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setErrors({});
    setMessage("");
    setBusy(true);
    try {
      await submitAuth(signup, values);
    } catch (err) {
      setErrors((err.data && err.data.fields) || {});
      setMessage(err.message);
      setBusy(false);
    }
  };

  return (
    <form id="authForm" data-mode={signup ? "signup" : "login"} noValidate ref={formRef} onSubmit={onSubmit}>
      {signup ? (
        <>
          <Field name="displayName" label="Your name" type="text" autoComplete="name" errors={errors} />
          <Field name="username" label="Username" type="text" autoComplete="username" hint="3–20 characters: letters, numbers, _ or ." errors={errors} />
          <Field name="email" label="Email" type="email" autoComplete="email" errors={errors} />
          <Field name="password" label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." errors={errors} />
        </>
      ) : (
        <>
          <Field name="login" label="Email or username" type="text" autoComplete="username" errors={errors} />
          <Field name="password" label="Password" type="password" autoComplete="current-password" errors={errors} />
        </>
      )}
      <p className="form-error" id="authError" role="alert">{message}</p>
      <button className="btn btn--primary btn--block" type="submit" disabled={busy}>{signup ? "Create account" : "Log in"}</button>
    </form>
  );
}

export function AuthModal() {
  const { auth } = app.use();
  const signup = auth.mode === "signup";

  useEffect(() => {
    document.documentElement.classList.toggle("modal-open", auth.open);
  }, [auth.open]);

  return (
    <div className="modal" id="authModal" hidden={!auth.open}>
      {auth.open ? (
        <>
          <div className="modal__backdrop" data-close-modal="" onClick={closeAuth} />
          <div className="modal__card" role="dialog" aria-modal="true" aria-labelledby="authTitle">
            <button className="modal__close" data-close-modal="" aria-label="Close" onClick={closeAuth}>
              <Icon name="close" />
            </button>
            <span className="logo"><span className="logo__mark" aria-hidden="true" />LUMIERE</span>
            <h2 className="modal__title" id="authTitle">{signup ? "Join the community" : "Welcome back"}</h2>
            <p className="modal__reason">{auth.reason || (signup
              ? "Create a free account to write reviews, like perfumes, chat with other fragrance lovers and add new perfumes."
              : "Log in to your LUMIERE account.")}</p>

            <AuthForm key={auth.seq} signup={signup} />

            <p className="modal__switch">
              {signup
                ? <>Already a member? <button className="link link--btn" data-auth="login" onClick={() => openAuth("login")}>Log in</button></>
                : <>New to LUMIERE? <button className="link link--btn" data-auth="signup" onClick={() => openAuth("signup")}>Create an account</button></>}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
