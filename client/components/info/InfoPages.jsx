import React, { useState } from "react";
import { app } from "../../store/app";
import { api } from "../../lib/api";
import { openAuth } from "../../store/ui";
import { Crumbs } from "../common/BackButton";
import { FieldError } from "../layout/FieldError";

const SUPPORT_EMAIL = "support@lumiere.com";

function InfoPage({ crumb, children }) {
  return (
    <div className="container pv info-page">
      <Crumbs>
        <span>LUMIERE / <strong>{crumb}</strong></span>
      </Crumbs>
      <article className="panel info-card">{children}</article>
    </div>
  );
}

export function AboutPage() {
  const { session } = app.use();
  return (
    <InfoPage crumb="About">
      <p className="info-card__eyebrow">About LUMIERE</p>
      <h1 className="info-card__title">Fragrance discovery, made personal</h1>
      <p className="info-card__lead">LUMIERE is a fragrance community for discovering new scents, sharing honest opinions and learning from other fragrance lovers. Our goal is to make finding your next favorite perfume feel simple, personal and social.</p>
      <ul className="info-points">
        <li><strong>Discover</strong><span>Explore perfumes by brand, notes and scent family, and see what's trending right now.</span></li>
        <li><strong>Review honestly</strong><span>Rate what you've tried and read real opinions — longevity, sillage, when to wear it.</span></li>
        <li><strong>Connect</strong><span>Follow other members, join discussion groups and chat with people who share your taste.</span></li>
      </ul>
      <div className="info-card__actions">
        <a className="btn btn--primary" href="#trending">Explore perfumes</a>
        {session.user
          ? <a className="btn btn--ghost" href="#groups">Browse groups</a>
          : <button className="btn btn--ghost" data-auth="signup" onClick={() => openAuth("signup")}>Join the community</button>}
      </div>
    </InfoPage>
  );
}

export function HelpPage() {
  const me = app.state.session.user;
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const value = (name) => String(form.elements[name].value || "").trim();
    const body = { name: value("name"), email: value("email"), message: value("message") };
    const fields = {};
    if (!body.name) fields.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) fields.email = "Please enter a valid email.";
    setErrors(fields);
    setMessage("");
    if (Object.keys(fields).length) return;
    setBusy(true);
    try {
      await api("/contact", { method: "POST", body });
      setDone(true);
    } catch (err) {
      setErrors((err.data && err.data.fields) || {});
      setMessage(err.message);
      setBusy(false);
    }
  };
  const invalid = (name) => (errors[name] ? "" : undefined);

  return (
    <InfoPage crumb="Help center">
      <p className="info-card__eyebrow">Help center</p>
      <h1 className="info-card__title">How can we help?</h1>
      <p className="info-card__lead">Have a question or need a hand? Email us at <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, or leave your name and email below and we'll get back to you.</p>
      <form className="info-form" id="contactForm" noValidate hidden={done} onSubmit={onSubmit}>
        <div className="info-form__row">
          <label className="field">
            <span className="field__label">Name</span>
            <input name="name" maxLength="80" autoComplete="name" defaultValue={me ? me.displayName : ""} required aria-invalid={invalid("name")} />
            <FieldError name="name" errors={errors} />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input name="email" type="email" maxLength="120" autoComplete="email" required aria-invalid={invalid("email")} />
            <FieldError name="email" errors={errors} />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Message <span className="field__optional">(optional)</span></span>
          <textarea name="message" rows="3" maxLength="1000" placeholder="Tell us a little about what you need" aria-invalid={invalid("message")} />
        </label>
        <div className="info-form__foot">
          <span className="composer__error" id="contactError" role="alert">{message}</span>
          <button type="submit" className="btn btn--primary" disabled={busy}>Send</button>
        </div>
      </form>
      <p className="info-form__done" id="contactDone" role="status" hidden={!done}>Thanks! We've got your details and will get back to you soon.</p>
    </InfoPage>
  );
}

export function PrivacyPage() {
  return (
    <InfoPage crumb="Privacy">
      <p className="info-card__eyebrow">Privacy &amp; terms</p>
      <h1 className="info-card__title">Using LUMIERE</h1>
      <p className="info-card__lead">By using LUMIERE, you agree to these simple rules. We keep them short on purpose.</p>
      <div className="info-columns">
        <section className="info-section">
          <h2>Be respectful</h2>
          <p>Use the platform kindly and honestly. Don't harass other members, post spam or misuse any features.</p>
        </section>
        <section className="info-section">
          <h2>Your account information</h2>
          <p>We store your account details — like your name, username and email — only to make the site work: signing in, your profile, likes, reviews and messages. We don't sell your information.</p>
        </section>
        <section className="info-section">
          <h2>What other members can see</h2>
          <p>Reviews, ratings, group posts, replies and your public profile are visible to other members. Private messages are only visible to you and the person you're chatting with.</p>
        </section>
      </div>
      <p className="info-card__note">Questions? Contact us at <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or visit the <a className="link" href="#help">Help center</a>.</p>
    </InfoPage>
  );
}
