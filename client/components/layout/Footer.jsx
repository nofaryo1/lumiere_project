import React from "react";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <a href="/" className="logo"><span className="logo__mark" aria-hidden="true" />LUMIERE</a>{" "}
          <p>The community for discovering, reviewing and talking about fragrance.</p>
        </div>
        <nav className="footer__links" aria-label="LUMIERE">
          <h3>LUMIERE</h3>
          <ul>
            <li><a href="#about">About</a></li>
            <li><a href="#help">Help center</a></li>
            <li><a href="#privacy">Privacy</a></li>
          </ul>
        </nav>
      </div>
      <div className="container footer__bottom">
        <p>&copy; <span id="year">{new Date().getFullYear()}</span> LUMIERE. All rights reserved.</p>
        <p>Made for fragrance lovers.</p>
      </div>
    </footer>
  );
}
